import { useState, useEffect, useRef, useMemo, useCallback, type RefObject } from 'react'
import { db } from '../db/db'
import type { TaskItem } from '../db/types'
import type { PendingSessionData } from '../types/app'
import { addRecoveredMinutes } from '../db/repositories/dailyLogs'
import { calculateSM2, formatHistoryTimestamp } from '../lib/studyDashboard'
import { devLog } from '../lib/devLogger'
import { requestWakeLock, releaseWakeLock } from '../lib/wakeLock'
import type { HistoryEntry } from '../db/types'

interface UseTimerEngineOptions {
  isDataReady: boolean
  studyBlockDurationMinutes: number
  shortBreakDurationMinutes: number
  longBreakDurationMinutes: number
  targetSessionsPerCycle: number
  initialEasinessFactor: number
  incrementStudy: () => Promise<void>
  incrementBreak: () => Promise<void>
  addHistoryEntry: (entry: Omit<HistoryEntry, 'id'> & { createdAt?: number }) => Promise<void>
  playChime: () => void
  createDatabaseSnapshot: () => Promise<void>
  pushToast: (key: string, message: string) => void
  activeTaskId: number | null
  setActiveTaskId: (id: number | null) => void
}

export function useTimerEngine({
  isDataReady,
  studyBlockDurationMinutes,
  shortBreakDurationMinutes,
  longBreakDurationMinutes,
  targetSessionsPerCycle,
  initialEasinessFactor,
  incrementStudy,
  incrementBreak,
  addHistoryEntry,
  playChime,
  createDatabaseSnapshot,
  pushToast,
  activeTaskId,
  setActiveTaskId,
}: UseTimerEngineOptions) {
  const [timerCategoryId, setTimerCategoryId] = useState<number | undefined>(undefined)
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [isTimerActive, setIsTimerActive] = useState(false)
  const [timerMode, setTimerMode] = useState<'study' | 'break'>('study')
  const [completedSessionsInCycle, setCompletedSessionsInCycle] = useState(0)
  const [isLongBreak, setIsLongBreak] = useState(false)
  const [extendedMinutes, setExtendedMinutes] = useState(0)
  const [showReflectionModal, setShowReflectionModal] = useState(false)
  const [pendingSessionData, setPendingSessionData] = useState<PendingSessionData | null>(null)
  const [attentionRating, setAttentionRating] = useState(4)
  const [stabilityRating, setStabilityRating] = useState(4)
  const [localSessionNotes, setLocalSessionNotes] = useState('')

  const completingRef = useRef(false)
  const incStudyRef = useRef(incrementStudy)
  const incBreakRef = useRef(incrementBreak)
  useEffect(() => {
    incStudyRef.current = incrementStudy
    incBreakRef.current = incrementBreak
  }, [incrementStudy, incrementBreak])

  const targetSeconds = useMemo(() => {
    let baseMin = studyBlockDurationMinutes
    if (timerMode !== 'study') {
      baseMin = isLongBreak ? longBreakDurationMinutes : shortBreakDurationMinutes
    }
    return (baseMin + extendedMinutes) * 60
  }, [timerMode, isLongBreak, longBreakDurationMinutes, shortBreakDurationMinutes, extendedMinutes, studyBlockDurationMinutes])

  const remainingSeconds = Math.max(0, targetSeconds - secondsElapsed)

  const processSessionCompletion = useCallback(async (
    elapsed: number,
    mode: 'study' | 'break',
    timestamp: string,
    categoryId?: number,
    attRating?: number,
    stabRating?: number,
    sessionNotes?: string,
  ) => {
    const now = Date.now()
    await addHistoryEntry({
      timestamp,
      createdAt: now,
      type: mode,
      durationMinutes: Math.floor(elapsed / 60) || 1,
      categoryId: mode === 'study' ? categoryId : undefined,
      sessionNotes: sessionNotes || undefined,
      ...(attRating !== undefined ? { attentionRating: attRating } : {}),
      ...(stabRating !== undefined ? { stabilityRating: stabRating } : {}),
    })

    playChime()
    devLog('timer', 'session-complete', { mode, elapsed })
    if (mode === 'study') {
      const studySessionCount = parseInt(localStorage.getItem('completed_study_sessions_count') || '0') + 1
      localStorage.setItem('completed_study_sessions_count', String(studySessionCount))
      if (studySessionCount % 5 === 0) {
        await createDatabaseSnapshot()
      }
      if (activeTaskId !== null) {
        const task = await db.tasks.get(activeTaskId)
        if (task) {
          const newActual = (task.actualCycles ?? 0) + 1
          const completed = newActual >= (task.estimatedCycles ?? 1)
          await db.tasks.update(activeTaskId, { actualCycles: newActual, completed })
          if (completed) setActiveTaskId(null)
        }
      }
    }
    completingRef.current = false

    if (mode === 'study') {
      setCompletedSessionsInCycle(prev => {
        const nextCount = prev + 1
        if (nextCount >= targetSessionsPerCycle) {
          setIsLongBreak(true)
          setTimerMode('break')
          setTimeout(() => playChime(), 400)
          return 0
        }
        setIsLongBreak(false)
        setTimerMode('break')
        return nextCount
      })
    } else {
      setTimerMode('study')
    }
  }, [addHistoryEntry, playChime, createDatabaseSnapshot, activeTaskId, setActiveTaskId, targetSessionsPerCycle])

  const completeSession = useCallback(async () => {
    if (completingRef.current) return
    completingRef.current = true
    const elapsed = secondsElapsed
    const mode = timerMode
    setIsTimerActive(false)
    setSecondsElapsed(0)
    setExtendedMinutes(0)
    const now = new Date()
    const timestamp = formatHistoryTimestamp(now)

    if (mode === 'study') {
      setPendingSessionData({ elapsed, mode, timestamp, categoryId: timerCategoryId })
      setAttentionRating(4)
      setStabilityRating(4)
      setLocalSessionNotes('')
      setShowReflectionModal(true)
      completingRef.current = false
      return
    }

    await processSessionCompletion(elapsed, mode, timestamp, timerCategoryId)
  }, [secondsElapsed, timerMode, timerCategoryId, processSessionCompletion])

  const handleModeSwitch = useCallback((mode: 'study' | 'break') => {
    if (completingRef.current) return
    if (mode === timerMode) return
    if (mode === 'study') setIsLongBreak(false)
    if (isTimerActive) setIsTimerActive(false)
    setSecondsElapsed(0)
    setExtendedMinutes(0)
    setTimerMode(mode)
    playChime()
  }, [timerMode, isTimerActive, playChime])

  const extendSession = useCallback(() => {
    setExtendedMinutes(m => m + 5)
    pushToast('TIMER', 'ADDED 5 MINUTES TO CURRENT TIMER')
  }, [pushToast])

  const skipBreak = useCallback(() => {
    if (timerMode !== 'break') return
    setSecondsElapsed(0)
    setExtendedMinutes(0)
    setTimerMode('study')
    setIsTimerActive(true)
    playChime()
    pushToast('TIMER', 'BREAK SKIPPED - STUDY BLOCK STARTED')
  }, [timerMode, playChime, pushToast])

  const submitRecallGrade = useCallback(async (task: TaskItem, q: number) => {
    if (task.id === undefined) return
    const { repetitionCount, easinessFactor, intervalDays } = calculateSM2(
      q,
      task.repetitionCount ?? 0,
      task.easinessFactor ?? initialEasinessFactor,
      task.intervalDays ?? 0
    )
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + intervalDays)
    const nextReviewDate = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`
    await db.tasks.update(task.id, {
      repetitionCount,
      easinessFactor,
      intervalDays,
      nextReviewDate,
      completed: true,
      latestGrade: q,
    })
    playChime()
  }, [initialEasinessFactor, playChime])

  useEffect(() => {
    if (!isTimerActive) return
    const id = setInterval(() => {
      setSecondsElapsed(s => {
        const ns = s + 1
        if (ns % 60 === 0) {
          if (timerMode === 'study') void incStudyRef.current()
          else void incBreakRef.current()
        }
        return ns
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isTimerActive, timerMode])

  useEffect(() => {
    if (isTimerActive && secondsElapsed >= targetSeconds) {
      // Auto-complete when the countdown reaches zero
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional timer boundary
      void completeSession()
    }
  }, [secondsElapsed, targetSeconds, isTimerActive, completeSession])

  useEffect(() => {
    if (!isDataReady) return
    const shadowStr = sessionStorage.getItem('active_session_shadow')
    if (!shadowStr) return
    try {
      const shadow = JSON.parse(shadowStr)
      if (shadow?.isTimerActive && shadow.secondsElapsed >= 60) {
        const runRestore = async () => {
          const elapsedMin = Math.floor(shadow.secondsElapsed / 60)
          const now = new Date()
          const timestamp = formatHistoryTimestamp(now)
          await addHistoryEntry({
            timestamp,
            createdAt: now.getTime(),
            type: shadow.mode,
            durationMinutes: elapsedMin,
            categoryId: shadow.mode === 'study' ? shadow.categoryId : undefined,
          })
          await addRecoveredMinutes(shadow.mode, elapsedMin)
          pushToast('RESTORE', `RECOVERED ${elapsedMin}M INTERRUPTED ${shadow.mode.toUpperCase()}`)
        }
        void runRestore()
      }
    } catch (err) {
      console.error('Failed to restore shadow session:', err)
    } finally {
      sessionStorage.removeItem('active_session_shadow')
    }
  }, [isDataReady, addHistoryEntry, pushToast])

  useEffect(() => {
    if (!isDataReady) return
    const shadow = {
      mode: timerMode,
      secondsElapsed,
      isTimerActive,
      categoryId: timerCategoryId,
      timestamp: Date.now(),
    }
    sessionStorage.setItem('active_session_shadow', JSON.stringify(shadow))
  }, [timerMode, secondsElapsed, isTimerActive, timerCategoryId, isDataReady])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && isTimerActive) {
        setIsTimerActive(false)
        pushToast('PAUSE', 'PAUSED - WORKSPACE INACTIVE')
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isTimerActive, pushToast])

  useEffect(() => {
    let activeSentinel: WakeLockSentinel | null = null
    let isMounted = true

    async function acquireLock() {
      if (isTimerActive && timerMode === 'study') {
        const lock = await requestWakeLock()
        if (isMounted && lock) activeSentinel = lock
      }
    }

    void acquireLock()

    return () => {
      isMounted = false
      if (activeSentinel) releaseWakeLock(activeSentinel)
    }
  }, [isTimerActive, timerMode])

  const submitReflection = useCallback(async (
    att: number,
    stab: number,
    notes: string,
    customElapsed?: number,
  ) => {
    setShowReflectionModal(false)
    const data = pendingSessionData
    setPendingSessionData(null)
    if (!data) return
    completingRef.current = true
    const finalElapsed = customElapsed !== undefined ? customElapsed : data.elapsed
    await processSessionCompletion(finalElapsed, data.mode, data.timestamp, data.categoryId, att, stab, notes)
  }, [pendingSessionData, processSessionCompletion])

  const resetTimerState = useCallback(() => {
    setSecondsElapsed(0)
    setIsTimerActive(false)
    setTimerMode('study')
    setTimerCategoryId(undefined)
    setCompletedSessionsInCycle(0)
    setIsLongBreak(false)
    setActiveTaskId(null)
  }, [setActiveTaskId])

  return {
    timerCategoryId,
    setTimerCategoryId,
    secondsElapsed,
    isTimerActive,
    setIsTimerActive,
    timerMode,
    completedSessionsInCycle,
    isLongBreak,
    targetSeconds,
    remainingSeconds,
    showReflectionModal,
    setShowReflectionModal,
    pendingSessionData,
    setPendingSessionData,
    attentionRating,
    setAttentionRating,
    stabilityRating,
    setStabilityRating,
    localSessionNotes,
    setLocalSessionNotes,
    completeSession,
    handleModeSwitch,
    extendSession,
    skipBreak,
    processSessionCompletion,
    submitRecallGrade,
    submitReflection,
    resetTimerState,
    completingRef: completingRef as RefObject<boolean>,
  }
}
