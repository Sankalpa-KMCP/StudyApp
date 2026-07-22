import { clamp, calculateStreak, formatHours, formatMinutes, formatShortTime, linePoints, percent } from '../appUtils'
import type { CalendarEvent, StudySession, StudySubject } from '../db/types'
import type { WeeklyStudyDay } from '../appUtils'
import { EmptyState, ProgressBar } from './ui'
import { BarChart3, CalendarDays, Flame } from 'lucide-react'

export function WeeklyProgress({ days }: { days: WeeklyStudyDay[] }) {
  const total = days.reduce((sum, day) => sum + day.hours, 0)
  return (
    <section className="card weekly-card" aria-labelledby="weekly-title">
      <div className="card-heading">
        <h2 id="weekly-title">Weekly Progress</h2>
        <BarChart3 size={20} aria-hidden="true" />
      </div>
      <strong className="large-stat">{formatHours(total)}</strong>
      <p>logged in the last seven days</p>
      <BarChart days={days} />
    </section>
  )
}

export function StudyTime({ days }: { days: WeeklyStudyDay[] }) {
  const values = days.map((day) => day.hours)
  return (
    <section className="card chart-card" aria-labelledby="study-time-title">
      <div className="card-heading">
        <div>
          <h2 id="study-time-title">Study Time</h2>
          <strong>{formatHours(values.reduce((sum, hours) => sum + hours, 0))}</strong>
        </div>
      </div>
      <div className="line-chart" aria-label="Study time trend">
        <svg viewBox="0 0 360 160" role="img" aria-label="Study time by day">
          <polyline points={linePoints(values)} />
          {values.map((value, index) => (
            <circle cx={index * 52 + 24} cy={146 - Math.min(value, 8) * 16} r="4" key={`${value}-${index}`} />
          ))}
        </svg>
        <div className="line-days" aria-hidden="true">
          {days.map((day) => <span key={day.key}>{day.label}</span>)}
        </div>
      </div>
    </section>
  )
}

export function Upcoming({ events, subjectMap, onViewAll }: { events: CalendarEvent[]; subjectMap: Map<string, StudySubject>; onViewAll: () => void }) {
  return (
    <section className="card upcoming-card" aria-labelledby="upcoming-title">
      <div className="section-heading">
        <h2 id="upcoming-title">Upcoming</h2>
        <button type="button" onClick={onViewAll}>View all</button>
      </div>
      {events.length > 0 ? (
        <div className="timeline">
          {events.map((event) => (
            <article className="event is-strong" key={event.id}>
              <time>{formatShortTime(event.startAt)}</time>
              <div>
                <h3>{event.title}</h3>
                <p>{subjectMap.get(event.subjectId)?.name ?? 'General'}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={CalendarDays} title="No upcoming events" body="Scheduled study blocks will appear here." actionLabel="Open calendar" onAction={onViewAll} />
      )}
    </section>
  )
}

export function StreakCard({ sessions }: { sessions: StudySession[] }) {
  const streak = calculateStreak(sessions)
  return (
    <section className="card streak-card" aria-labelledby="streak-title">
      <h2 id="streak-title">Streak</h2>
      <div className="flame-disc">
        <Flame size={33} aria-hidden="true" />
      </div>
      <strong>{streak}</strong>
      <p>days with logged study</p>
      <span>{streak > 0 ? 'Consistency is building.' : 'Log a session to start.'}</span>
    </section>
  )
}

export function ReviewQueue({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <section className="card review-card" aria-labelledby="review-title">
      <h2 id="review-title">Review Queue</h2>
      <strong>{count}</strong>
      <p>cards waiting for another pass</p>
      <button className="secondary-command" type="button" onClick={onOpen}>Review cards</button>
    </section>
  )
}

export function SubjectDistribution({ subjects, sessions, subjectMap }: { subjects: StudySubject[]; sessions: StudySession[]; subjectMap: Map<string, StudySubject> }) {
  const rows = subjects.map((subject) => ({
    subject,
    minutes: sessions.filter((session) => session.subjectId === subject.id).reduce((sum, session) => sum + session.minutes, 0),
  }))

  return (
    <section className="card distribution-card" aria-labelledby="distribution-title">
      <h2 id="distribution-title">Subject Distribution</h2>
      {rows.some((row) => row.minutes > 0) ? (
        <div className="distribution-list">
          {rows.map((row) => (
            <ProgressBar
              key={row.subject.id}
              value={percent(row.minutes, Math.max(1, sessions.reduce((sum, session) => sum + session.minutes, 0)))}
              label={`${subjectMap.get(row.subject.id)?.name ?? row.subject.name} - ${formatMinutes(row.minutes)}`}
            />
          ))}
        </div>
      ) : (
        <p className="muted-copy">Log study sessions to see where your time is going.</p>
      )}
    </section>
  )
}

export function BarChart({ days }: { days: WeeklyStudyDay[] }) {
  const values = days.map((day) => day.hours)
  return (
    <>
      <div className="bar-chart" role="img" aria-label="Weekly progress by day">
        {days.map((day) => (
          <span className={day.hours === Math.max(...values) && day.hours > 0 ? 'bar is-peak' : 'bar'} key={`${day.key}-${day.hours}`}>
            <span style={{ height: `${clamp((day.hours / Math.max(1, Math.max(...values))) * 100, 8, 100)}%` }} />
          </span>
        ))}
      </div>
      <div className="bar-days" aria-hidden="true">
        {days.map((day) => <span key={day.key}>{day.label}</span>)}
      </div>
    </>
  )
}
