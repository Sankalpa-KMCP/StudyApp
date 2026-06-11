import type { MutableRefObject } from 'react'
import { useCallback, useEffect } from 'react'
import { addRecoveredMinutes } from '../../db/repositories/dailyLogs'
import { formatHistoryTimestamp } from '../../lib/studyDashboard'
import type { HistoryEntry } from '../../db/types'

export interface TimerShadowRefs {
  timerModeRef: MutableRefObject<'study' | 'break'>
  secondsElapsedRef: MutableRefObject<number>
  isTimerActiveRef: MutableRefObject<boolean>
  timerCategoryIdRef: MutableRefObject<number | undefined>
  lastShadowWriteRef: MutableRefObject<number>
}

interface UseTimerSessionShadowOptions {
  isDataReady: boolean
  refs: TimerShadowRefs
  timerMode: 'study' | 'break'
  secondsElapsed: number
  isTimerActive: boolean
  timerCategoryId: number | undefined
  syncElapsedFromWall: () => void
  addHistoryEntry: (entry: Omit<HistoryEntry, 'id'> & { createdAt?: number }) => Promise<void>
  pushToast: (key: string, message: string) => void
}

export function useTimerSessionShadow({
  isDataReady,
  refs,
  timerMode,
  secondsElapsed,
  isTimerActive,
  timerCategoryId,
  syncElapsedFromWall,
  addHistoryEntry,
  pushToast,
}: UseTimerSessionShadowOptions) {
  const writeSessionShadow = useCallback((force = false) => {
    if (!isDataReady) return
    const now = Date.now()
    if (!force && now - refs.lastShadowWriteRef.current < 5000) return
    refs.lastShadowWriteRef.current = now
    const shadow = {
      mode: refs.timerModeRef.current,
      secondsElapsed: refs.secondsElapsedRef.current,
      isTimerActive: refs.isTimerActiveRef.current,
      categoryId: refs.timerCategoryIdRef.current,
      timestamp: now,
    }
    sessionStorage.setItem('active_session_shadow', JSON.stringify(shadow))
  }, [isDataReady, refs])

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
      if (refs.isTimerActiveRef.current) {
        syncElapsedFromWall()
        writeSessionShadow(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [syncElapsedFromWall, writeSessionShadow, refs.isTimerActiveRef])

  return { writeSessionShadow }
}
