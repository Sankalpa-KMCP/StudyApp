import { BookOpen, Plus } from './icons'
import { formatMinutes, percent } from '../appUtils'
import { formatHeroDate, getTimeOfDayGreeting } from './heroDate'

export function HeroRow(props: {
  currentDate: Date
  todayFocusMinutes: number
  dailyGoalMinutes: number
  onCreateTask: () => void
  onCreateSubject: () => void
}) {
  const todayLabel = formatHeroDate(props.currentDate)
  const greeting = getTimeOfDayGreeting(props.currentDate)

  return (
    <section className="hero-row" aria-label="Today overview">
      <div className="hero-copy">
        <span className="eyebrow">{todayLabel}</span>
        <h1>{greeting}</h1>
        <p>Choose the next useful thing, then give it your full attention.</p>
      </div>
      <div className="hero-metrics" aria-label="Today focus summary">
        <span>
          <strong>{formatMinutes(props.todayFocusMinutes)}</strong>
          focused today
        </span>
        <span>
          <strong>{Math.round(percent(props.todayFocusMinutes, props.dailyGoalMinutes))}%</strong>
          goal complete
        </span>
      </div>
      <div className="hero-actions">
        <button className="secondary-command" type="button" onClick={props.onCreateSubject}>
          <BookOpen size={17} aria-hidden="true" />
          Subject
        </button>
        <button className="primary-command" type="button" onClick={props.onCreateTask}>
          <Plus size={17} aria-hidden="true" />
          Task
        </button>
      </div>
    </section>
  )
}
