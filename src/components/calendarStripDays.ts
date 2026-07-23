import type { CalendarEvent } from '../db/types'
import { localDateKey } from '../appUtils'

export type CalendarStripDay = {
  key: string
  day: string
  date: number
  count: number
}

/** Optional `toDayKey` is for deterministic timezone-offset tests only; production uses `localDateKey`. */
export function getCalendarStripDays(
  events: CalendarEvent[],
  now: Date = new Date(),
  toDayKey: (value: string | Date) => string = localDateKey,
): CalendarStripDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now)
    date.setDate(date.getDate() + index)
    const key = toDayKey(date)
    return {
      key,
      day: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date),
      date: date.getDate(),
      count: events.filter((event) => toDayKey(event.startAt) === key).length,
    }
  })
}
