import { useState, useEffect, useRef, useMemo, useCallback, type RefObject, type SetStateAction } from 'react'
import { db } from '../db/db'
import type { TaskItem } from '../db/types'
import type { PendingSessionData } from '../types/app'
import { addRecoveredMinutes } from '../db/repositories/dailyLogs'
import { calculateSM2, formatHistoryTimestamp } from '../lib/studyDashboard'
import { devLog } from '../lib/devLogger'
import { sendFocusBlockCompleteNotification } from '../lib/focusNotifications'
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
  focusNotificationsEnabled: boolean
}

function elapsedFromAnchor(anchorWallMs: number, anchorElapsed: number): number {
  return anchorElapsed + Math.floor((Date.now() - anchorWallMs) / 1000)
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
  focusNotificationsEnabled,
}: UseTimerEngineOptions) {
  const [timerCategoryId, setTimerCategoryId] = useState<number | undefined>(undefined)
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [isTimerActive, setIsTimerActiveState] = useState(false)
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
  const anchorRef = useRef({ wallMs: 0, elapsed: 0 })
  const lastMinuteLoggedRef = useRef(0)
  const lastShadowWriteRef = useRef(0)
  const isTimerActiveRef = useRef(isTimerActive)
  const timerModeRef = useRef(timerMode)
  const timerCategoryIdRef = useRef(timerCategoryId)
  const secondsElapsedRef = useRef(secondsElapsed)

  useEffect(() => {
    incStudyRef.current = incrementStudy
    incBreakRef.current = incrementBreak
  }, [incrementStudy, incrementBreak])

  useEffect(() => {
    isTimerActiveRef.current = isTimerActive
  }, [isTimerActive])

  useEffect(() => {
    timerModeRef.current = timerMode
  }, [timerMode])

  useEffect(() => {
    timerCategoryIdRef.current = timerCategoryId
  }, [timerCategoryId])

  useEffect(() => {
    secondsElapsedRef.current = secondsElapsed
  }, [secondsElapsed])

  const resetAnchor = useCallback((elapsed: number) => {
    anchorRef.current = { wallMs: Date.now(), elapsed }
    lastMinuteLoggedRef.current = Math.floor(elapsed / 60)
  }, [])

  const setIsTimerActive = useCallback((value: SetStateAction<boolean>) => {
    setIsTimerActiveState(prev => {
      const next = typeof value === 'function' ? value(prev) : value
      if (next && !prev) {
        resetAnchor(secondsElapsedRef.current)
      }
      return next
    })
  }, [resetAnchor])

  const targetSeconds = useMemo(() => {
    let baseMin = studyBlockDurationMinutes
    if (timerMode !== 'study') {
      baseMin = isLongBreak ? longBreakDurationMinutes : shortBreakDurationMinutes
    }
    return (baseMin + extendedMinutes) * 60
  }, [timerMode, isLongBreak, longBreakDurationMinutes, shortBreakDurationMinutes, extendedMinutes, studyBlockDurationMinutes])

  const remainingSeconds = Math.max(0, targetSeconds - secondsElapsed)
  const progress = targetSeconds > 0 ? Math.min(1, secondsElapsed / targetSeconds) : 0

  const writeSessionShadow = useCallback((force = false) => {
    if (!isDataReady) return
    const now = Date.now()
    if (!force && now - lastShadowWriteRef.current < 5000) return
    lastShadowWriteRef.current = now
    const shadow = {
      mode: timerModeRef.current,
      secondsElapsed: secondsElapsedRef.current,
      isTimerActive: isTimerActiveRef.current,
      categoryId: timerCategoryIdRef.current,
      timestamp: now,
    }
    sessionStorage.setItem('active_session_shadow', JSON.stringify(shadow))
  }, [isDataReady])

  const syncElapsedFromWall = useCallback(() => {
    const computed = elapsedFromAnchor(anchorRef.current.wallMs, anchorRef.current.elapsed)
    setSecondsElapsed(prev => {
      const newMinutes = Math.floor(computed / 60)
      const prevMinutes = Math.floor(prev / 60)
      if (newMinutes > prevMinutes) {
        for (let m = prevMinutes + 1; m <= newMinutes; m++) {
          if (timerModeRef.current === 'study') void incStudyRef.current()
          else void incBreakRef.current()
        }
      }
      return computed
    })
  }, [])

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
    if (focusNotificationsEnabled) {
      sendFocusBlockCompleteNotification(mode)
    }
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
  }, [addHistoryEntry, playChime, createDatabaseSnapshot, activeTaskId, setActiveTaskId, targetSessionsPerCycle, focusNotificationsEnabled])

  const completeSession = useCallback(async () => {
    if (completingRef.current) return
    completingRef.current = true
    const elapsed = secondsElapsedRef.current
    const mode = timerMode
    setIsTimerActive(false)
    setSecondsElapsed(0)
    resetAnchor(0)
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
  }, [timerMode, timerCategoryId, processSessionCompletion, setIsTimerActive, resetAnchor])

  const handleModeSwitch = useCallback((mode: 'study' | 'break') => {
    if (completingRef.current) return
    if (mode === timerMode) return
    if (mode === 'study') setIsLongBreak(false)
    if (isTimerActive) setIsTimerActive(false)
    setSecondsElapsed(0)
    secondsElapsedRef.current = 0
    resetAnchor(0)
    setExtendedMinutes(0)
    setTimerMode(mode)
    playChime()
  }, [timerMode, isTimerActive, playChime, setIsTimerActive, resetAnchor])

  const extendSession = useCallback(() => {
    setExtendedMinutes(m => m + 5)
    pushToast('TIMER', 'ADDED 5 MINUTES TO CURRENT TIMER')
  }, [pushToast])

  const skipBreak = useCallback(() => {
    if (timerMode !== 'break') return
    setSecondsElapsed(0)
    secondsElapsedRef.current = 0
    resetAnchor(0)
    setExtendedMinutes(0)
    setTimerMode('study')
    setIsTimerActive(true)
    playChime()
    pushToast('TIMER', 'BREAK SKIPPED - STUDY BLOCK STARTED')
  }, [timerMode, playChime, pushToast, setIsTimerActive, resetAnchor])

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

    const tick = () => syncElapsedFromWall()
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [isTimerActive, syncElapsedFromWall])

  useEffect(() => {
    if (isTimerActive && secondsElapsed >= targetSeconds) {
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
    writeSessionShadow()
  }, [timerMode, secondsElapsed, isTimerActive, timerCategoryId, writeSessionShadow])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        writeSessionShadow(true)
        return
      }
      if (isTimerActiveRef.current) {
        syncElapsedFromWall()
        writeSessionShadow(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [syncElapsedFromWall, writeSessionShadow])

  useEffect(() => {
    let activeSentinel: WakeLockSentinel | null = null
    let isMounted = true

    async function acquireLock() {
      if (isTimerActive && timerMode === 'study' && !document.hidden) {
        if (activeSentinel) {
          await releaseWakeLock(activeSentinel)
          activeSentinel = null
        }
        const lock = await requestWakeLock()
        if (isMounted && lock) activeSentinel = lock
      }
    }

    void acquireLock()

    const onVisibility = () => { void acquireLock() }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      isMounted = false
      document.removeEventListener('visibilitychange', onVisibility)
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
    resetAnchor(0)
    setIsTimerActive(false)
    setTimerMode('study')
    setTimerCategoryId(undefined)
    setCompletedSessionsInCycle(0)
    setIsLongBreak(false)
    setActiveTaskId(null)
  }, [setActiveTaskId, setIsTimerActive, resetAnchor])

  const controls = useMemo(() => ({
    timerCategoryId,
    setTimerCategoryId,
    isTimerActive,
    setIsTimerActive,
    timerMode,
    completedSessionsInCycle,
    isLongBreak,
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
  }), [
    timerCategoryId,
    isTimerActive,
    setIsTimerActive,
    timerMode,
    completedSessionsInCycle,
    isLongBreak,
    showReflectionModal,
    pendingSessionData,
    attentionRating,
    stabilityRating,
    localSessionNotes,
    completeSession,
    handleModeSwitch,
    extendSession,
    skipBreak,
    processSessionCompletion,
    submitRecallGrade,
    submitReflection,
    resetTimerState,
  ])

  const display = useMemo(() => ({
    secondsElapsed,
    remainingSeconds,
    targetSeconds,
    progress,
  }), [secondsElapsed, remainingSeconds, targetSeconds, progress])

  return { controls, display }
}
