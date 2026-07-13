import type { CalendarEvent } from '../db/types'

export function CalendarStrip({ events }: { events: CalendarEvent[] }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() + index)
    const key = date.toISOString().slice(0, 10)
    return {
      key,
      day: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date),
      date: date.getDate(),
      count: events.filter((event) => event.startAt.slice(0, 10) === key).length,
    }
  })

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
