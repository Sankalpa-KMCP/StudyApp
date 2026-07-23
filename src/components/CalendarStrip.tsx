import type { CalendarEvent } from '../db/types'
import { getCalendarStripDays } from './calendarStripDays'

export function CalendarStrip({ events }: { events: CalendarEvent[] }) {
  const days = getCalendarStripDays(events)

  return (
    <div className="calendar-strip" aria-label="Seven day calendar">
      {days.map((day) => (
        <article className={day.count > 0 ? 'calendar-day has-events' : 'calendar-day'} key={day.key}>
          <span>{day.day}</span>
          <strong>{day.date}</strong>
          <small>{day.count} {day.count === 1 ? 'event' : 'events'}</small>
        </article>
      ))}
    </div>
  )
}
