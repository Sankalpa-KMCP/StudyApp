import type { MutableRefObject } from 'react'
import { useCallback, useEffect } from 'react'
import { elapsedFromAnchor } from './timerAnchor'

interface UseTimerTickOptions {
  isTimerActive: boolean
  secondsElapsed: number
  targetSeconds: number
  anchorRef: MutableRefObject<{ wallMs: number; elapsed: number }>
  timerModeRef: MutableRefObject<'study' | 'break'>
  incStudyRef: MutableRefObject<() => Promise<void>>
  incBreakRef: MutableRefObject<() => Promise<void>>
  setSecondsElapsed: React.Dispatch<React.SetStateAction<number>>
  completeSession: () => Promise<void | 'reflection' | 'completed' | 'blocked'>
}

export function useTimerTick({
  isTimerActive,
  secondsElapsed,
  targetSeconds,
  anchorRef,
  timerModeRef,
  incStudyRef,
  incBreakRef,
  setSecondsElapsed,
  completeSession,
}: UseTimerTickOptions) {
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
  }, [anchorRef, timerModeRef, incStudyRef, incBreakRef, setSecondsElapsed])

  useEffect(() => {
    if (!isTimerActive) return

    const tick = () => {
      if (document.visibilityState !== 'hidden') {
        syncElapsedFromWall()
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [isTimerActive, syncElapsedFromWall])

  useEffect(() => {
    if (isTimerActive && secondsElapsed >= targetSeconds) {
      void completeSession()
    }
  }, [secondsElapsed, targetSeconds, isTimerActive, completeSession])

  return { syncElapsedFromWall }
}
