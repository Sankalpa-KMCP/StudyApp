import { BookOpen, Plus } from 'lucide-react'
import { formatMinutes, percent } from '../appUtils'
import type { View } from '../App'

const todayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date())

export function HeroRow(props: {
  activeView: View
  todayFocusMinutes: number
  dailyGoalMinutes: number
  onCreateTask: () => void
  onCreateSubject: () => void
}) {
  return (
    <section className="hero-row" aria-label="Today overview">
      <div className="hero-copy">
        <span className="eyebrow">{todayLabel}</span>
        <h1>Good morning</h1>
        <p>{props.activeView === 'Home' ? 'A quiet place to turn intention into progress—one focused block at a time.' : `${props.activeView} is open. Everything stays saved on this device.`}</p>
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
      <div className="date-stack">
        <strong>{formatMinutes(props.dailyGoalMinutes)}</strong>
        <span>daily goal</span>
      </div>
    </section>
  )
}
