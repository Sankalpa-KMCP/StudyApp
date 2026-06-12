import { useState, useRef, useMemo, useCallback, useEffect, type RefObject, type SetStateAction } from 'react'
import type { TaskItem, HistoryEntry } from '../db/types'
import { updateTask } from '../db/repositories/tasks'
import { calculateSM2, calculateFSRS, formatHistoryTimestamp } from '../lib/study/studyDashboard'
import { resolveTimerDurations } from '../lib/study/resolveTimerDurations'
import type { CategoryItem } from '../db/types'
import { createAnchorState } from './timer/timerAnchor'
import { useTimerSessionShadow } from './timer/useTimerSessionShadow'
import { useTimerCompletion } from './timer/useTimerCompletion'
import { useWakeLock } from './timer/useWakeLock'
import { BREAK_ENDED } from '../lib/shared/uxTerms'
import { useTimerReflection } from './timer/useTimerReflection'
import { useTimerTick } from './timer/useTimerTick'

interface UseTimerEngineOptions {
  isDataReady: boolean
  studyBlockDurationMinutes: number
  shortBreakDurationMinutes: number
  longBreakDurationMinutes: number
  targetSessionsPerCycle: number
  initialEasinessFactor: number
  schedulingAlgorithm?: 'sm2' | 'fsrs'
  sessionTasks: TaskItem[]
  categories: CategoryItem[]
  incrementStudy: () => Promise<void>
  incrementBreak: () => Promise<void>
  addHistoryEntry: (entry: Omit<HistoryEntry, 'id'> & { createdAt?: number }) => Promise<void>
  playChime: () => void
  createDatabaseSnapshot: () => Promise<void>
  pushToast: (key: string, message: string) => void
  activeTaskId: number | null
  setActiveTaskId: (id: number | null) => void
  focusNotificationsEnabled: boolean
  desktopNativeNotificationsEnabled?: boolean
}

export function useTimerEngine({
  isDataReady,
  studyBlockDurationMinutes,
  shortBreakDurationMinutes,
  longBreakDurationMinutes,
  targetSessionsPerCycle,
  initialEasinessFactor,
  schedulingAlgorithm = 'sm2',
  sessionTasks,
  categories,
  incrementStudy,
  incrementBreak,
  addHistoryEntry,
  playChime,
  createDatabaseSnapshot,
  pushToast,
  activeTaskId,
  setActiveTaskId,
  focusNotificationsEnabled,
  desktopNativeNotificationsEnabled = false,
}: UseTimerEngineOptions) {
  const [timerCategoryId, setTimerCategoryId] = useState<number | undefined>(undefined)
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [isTimerActive, setIsTimerActiveState] = useState(false)
  const [timerMode, setTimerMode] = useState<'study' | 'break'>('study')
  const [completedSessionsInCycle, setCompletedSessionsInCycle] = useState(0)
  const [isLongBreak, setIsLongBreak] = useState(false)
  const [extendedMinutes, setExtendedMinutes] = useState(0)

  const completingRef = useRef(false)
  const incStudyRef = useRef(incrementStudy)
  const incBreakRef = useRef(incrementBreak)
  const anchorRef = useRef(createAnchorState(0))
  const lastMinuteLoggedRef = useRef(0)
  const lastShadowWriteRef = useRef(0)
  const isTimerActiveRef = useRef(isTimerActive)
  const timerModeRef = useRef(timerMode)
  const timerCategoryIdRef = useRef(timerCategoryId)
  const secondsElapsedRef = useRef(secondsElapsed)
  const activeTaskIdRef = useRef(activeTaskId)

  useEffect(() => {
    incStudyRef.current = incrementStudy
    incBreakRef.current = incrementBreak
  }, [incrementStudy, incrementBreak])

  useEffect(() => { isTimerActiveRef.current = isTimerActive }, [isTimerActive])
  useEffect(() => { timerModeRef.current = timerMode }, [timerMode])
  useEffect(() => { timerCategoryIdRef.current = timerCategoryId }, [timerCategoryId])
  useEffect(() => { secondsElapsedRef.current = secondsElapsed }, [secondsElapsed])
  useEffect(() => { activeTaskIdRef.current = activeTaskId }, [activeTaskId])

  const resetAnchor = useCallback((elapsed: number) => {
    anchorRef.current = createAnchorState(elapsed)
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

  const resolvedDurations = useMemo(() => {
    const activeTask = activeTaskId != null ? sessionTasks.find(t => t.id === activeTaskId) ?? null : null
    const category = timerCategoryId !== undefined ? categories.find(c => c.id === timerCategoryId) ?? null : null
    return resolveTimerDurations(
      { studyBlockDurationMinutes, shortBreakDurationMinutes, longBreakDurationMinutes },
      activeTask,
      category,
    )
  }, [activeTaskId, sessionTasks, timerCategoryId, categories, studyBlockDurationMinutes, shortBreakDurationMinutes, longBreakDurationMinutes])

  const targetSeconds = useMemo(() => {
    let baseMin = resolvedDurations.studyBlockDurationMinutes
    if (timerMode !== 'study') {
      baseMin = isLongBreak ? resolvedDurations.longBreakDurationMinutes : resolvedDurations.shortBreakDurationMinutes
    }
    return (baseMin + extendedMinutes) * 60
  }, [timerMode, isLongBreak, resolvedDurations, extendedMinutes])

  const remainingSeconds = Math.max(0, targetSeconds - secondsElapsed)
  const progress = targetSeconds > 0 ? Math.min(1, secondsElapsed / targetSeconds) : 0

  const { processSessionCompletion } = useTimerCompletion({
    completingRef,
    addHistoryEntry,
    playChime,
    createDatabaseSnapshot,
    focusNotificationsEnabled,
    desktopNativeNotificationsEnabled,
    activeTaskId,
    setActiveTaskId,
    targetSessionsPerCycle,
    setCompletedSessionsInCycle,
    setIsLongBreak,
    setTimerMode,
  })

  const reflection = useTimerReflection({ completingRef, processSessionCompletion })

  const completeSession = useCallback(async (): Promise<'reflection' | 'completed' | 'blocked'> => {
    if (completingRef.current) return 'blocked'
    completingRef.current = true
    const elapsed = secondsElapsedRef.current
    const mode = timerMode
    setIsTimerActive(false)
    setSecondsElapsed(0)
    resetAnchor(0)
    setExtendedMinutes(0)
    const timestamp = formatHistoryTimestamp(new Date())

    if (mode === 'study') {
      reflection.openReflection({ elapsed, mode, timestamp, categoryId: timerCategoryId })
      return 'reflection'
    }

    await processSessionCompletion(elapsed, mode, timestamp, timerCategoryId)
    return 'completed'
  }, [timerMode, timerCategoryId, processSessionCompletion, setIsTimerActive, resetAnchor, reflection])

  const { syncElapsedFromWall } = useTimerTick({
    isTimerActive,
    secondsElapsed,
    targetSeconds,
    anchorRef,
    timerModeRef,
    incStudyRef,
    incBreakRef,
    setSecondsElapsed,
    completeSession,
  })

  useTimerSessionShadow({
    isDataReady,
    refs: {
      timerModeRef,
      secondsElapsedRef,
      isTimerActiveRef,
      timerCategoryIdRef,
      activeTaskIdRef,
      lastShadowWriteRef,
    },
    timerMode,
    secondsElapsed,
    isTimerActive,
    timerCategoryId,
    syncElapsedFromWall,
    addHistoryEntry,
    pushToast,
  })

  const { wakeLockActive } = useWakeLock(isTimerActive, timerMode)

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
    pushToast('TIMER', 'Added 5 minutes to current timer')
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
    pushToast('TIMER', BREAK_ENDED)
  }, [timerMode, playChime, pushToast, setIsTimerActive, resetAnchor])

  const submitRecallGrade = useCallback(async (task: TaskItem, q: number) => {
    if (task.id === undefined) return
    const gradeResult = schedulingAlgorithm === 'fsrs'
      ? calculateFSRS(q, {
          stability: task.easinessFactor ?? initialEasinessFactor,
          difficulty: task.latestGrade ?? 5,
          repetitionCount: task.repetitionCount ?? 0,
          elapsedDays: 0,
        }, initialEasinessFactor)
      : calculateSM2(q, task.repetitionCount ?? 0, task.easinessFactor ?? initialEasinessFactor, task.intervalDays ?? 0)
    const { repetitionCount, easinessFactor, intervalDays } = gradeResult
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + intervalDays)
    const nextReviewDate = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`
    await updateTask(task.id, {
      repetitionCount,
      easinessFactor,
      intervalDays,
      nextReviewDate,
      completed: true,
      latestGrade: q,
      ...(schedulingAlgorithm === 'fsrs'
        ? { stability: (gradeResult as ReturnType<typeof calculateFSRS>).stability, difficulty: (gradeResult as ReturnType<typeof calculateFSRS>).difficulty }
        : {}),
    })
    playChime()
  }, [initialEasinessFactor, schedulingAlgorithm, playChime])

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
    showReflectionModal: reflection.showReflectionModal,
    setShowReflectionModal: reflection.setShowReflectionModal,
    pendingSessionData: reflection.pendingSessionData,
    setPendingSessionData: reflection.setPendingSessionData,
    attentionRating: reflection.attentionRating,
    setAttentionRating: reflection.setAttentionRating,
    stabilityRating: reflection.stabilityRating,
    setStabilityRating: reflection.setStabilityRating,
    localSessionNotes: reflection.localSessionNotes,
    setLocalSessionNotes: reflection.setLocalSessionNotes,
    completeSession,
    handleModeSwitch,
    extendSession,
    skipBreak,
    processSessionCompletion,
    submitRecallGrade,
    submitReflection: reflection.submitReflection,
    skipReflection: reflection.skipReflection,
    resetTimerState,
    wakeLockActive,
    completingRef: completingRef as RefObject<boolean>,
  }), [
    timerCategoryId,
    isTimerActive,
    setIsTimerActive,
    timerMode,
    completedSessionsInCycle,
    isLongBreak,
    reflection,
    completeSession,
    handleModeSwitch,
    extendSession,
    skipBreak,
    processSessionCompletion,
    submitRecallGrade,
    resetTimerState,
    wakeLockActive,
  ])

  const display = useMemo(() => ({
    secondsElapsed,
    remainingSeconds,
    targetSeconds,
    progress,
  }), [secondsElapsed, remainingSeconds, targetSeconds, progress])

  return { controls, display }
}
