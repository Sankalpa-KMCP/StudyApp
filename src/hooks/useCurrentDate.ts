import { useEffect, useState } from 'react'

/**
 * Milliseconds from `from` until the next local calendar midnight
 * (`YYYY-MM-DD+1` at 00:00:00.000 local), not a fixed 24-hour interval.
 */
export function getMillisecondsUntilNextLocalMidnight(from: Date): number {
  const nextMidnight = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + 1,
    0,
    0,
    0,
    0,
  )
  return Math.max(0, nextMidnight.getTime() - from.getTime())
}

/**
 * Current wall-clock `Date` that updates after each local midnight.
 * Late timer callbacks re-read `new Date()` and reschedule from that instant.
 */
export function useCurrentDate(): Date {
  const [currentDate, setCurrentDate] = useState(() => new Date())

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    const scheduleNextRollover = () => {
      if (cancelled) return
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }

      const delay = getMillisecondsUntilNextLocalMidnight(new Date())
      timeoutId = setTimeout(() => {
        timeoutId = undefined
        if (cancelled) return
        setCurrentDate(new Date())
        scheduleNextRollover()
      }, delay)
    }

    scheduleNextRollover()

    return () => {
      cancelled = true
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }
    }
  }, [])

  return currentDate
}
