import type { MutableRefObject } from 'react'
import { useCallback } from 'react'
import type { HistoryEntry } from '../../db/types'
import { getTask, incrementActualCycles } from '../../db/repositories/tasks'
import { devLog } from '../../lib/shared/devLogger'
import { sendFocusBlockCompleteNotification } from '../../lib/desktop/focusNotifications'

interface UseTimerCompletionOptions {
  completingRef: MutableRefObject<boolean>
  addHistoryEntry: (entry: Omit<HistoryEntry, 'id'> & { createdAt?: number }) => Promise<void>
  playChime: () => void
  createDatabaseSnapshot: () => Promise<void>
  focusNotificationsEnabled: boolean
  desktopNativeNotificationsEnabled?: boolean
  activeTaskId: number | null
  setActiveTaskId: (id: number | null) => void
  targetSessionsPerCycle: number
  setCompletedSessionsInCycle: React.Dispatch<React.SetStateAction<number>>
  setIsLongBreak: React.Dispatch<React.SetStateAction<boolean>>
  setTimerMode: React.Dispatch<React.SetStateAction<'study' | 'break'>>
}

export function useTimerCompletion({
  completingRef,
  addHistoryEntry,
  playChime,
  createDatabaseSnapshot,
  focusNotificationsEnabled,
  desktopNativeNotificationsEnabled = false,
  activeTaskId,
  setActiveTaskId,
  targetSessionsPerCycle,
  setCompletedSessionsInCycle,
  setIsLongBreak,
  setTimerMode,
}: UseTimerCompletionOptions) {
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
      taskId: mode === 'study' && activeTaskId != null ? activeTaskId : undefined,
      sessionNotes: sessionNotes || undefined,
      ...(attRating !== undefined ? { attentionRating: attRating } : {}),
      ...(stabRating !== undefined ? { stabilityRating: stabRating } : {}),
    })

    playChime()
    if (desktopNativeNotificationsEnabled) {
      sendFocusBlockCompleteNotification(mode, { useDesktopNative: true })
    } else if (focusNotificationsEnabled) {
      sendFocusBlockCompleteNotification(mode)
    }
    devLog('timer', 'session-complete', { mode, elapsed })
    if (mode === 'study') {
      window.dispatchEvent(new CustomEvent('celebrate-complete', { detail: { count: 80 } }))
      const studySessionCount = parseInt(localStorage.getItem('completed_study_sessions_count') || '0') + 1
      localStorage.setItem('completed_study_sessions_count', String(studySessionCount))
      if (studySessionCount % 5 === 0) {
        await createDatabaseSnapshot()
      }
      if (activeTaskId !== null) {
        const task = await getTask(activeTaskId)
        if (task) {
          const { completed } = await incrementActualCycles(activeTaskId, task.estimatedCycles ?? 1)
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
  }, [
    addHistoryEntry,
    playChime,
    createDatabaseSnapshot,
    activeTaskId,
    setActiveTaskId,
    targetSessionsPerCycle,
    focusNotificationsEnabled,
    desktopNativeNotificationsEnabled,
    completingRef,
    setCompletedSessionsInCycle,
    setIsLongBreak,
    setTimerMode,
  ])

  return { processSessionCompletion }
}
