import { BookOpen, Plus } from './icons'
import { formatMinutes, percent } from '../appUtils'
import { formatHeroDate, getTimeOfDayGreeting } from './heroDate'
import { DashboardModeControl } from './DashboardModeControl'
import type { DensityMode } from '../hooks/useDensityPreference'
import type { CanEnterZenReason } from '../hooks/useFocusSession'

export function HeroRow(props: {
  currentDate: Date
  todayFocusMinutes: number
  dailyGoalMinutes: number
  onCreateTask: () => void
  onCreateSubject: () => void
  density?: DensityMode
  onDensityChange?: (density: DensityMode) => void
  canEnterZen?: boolean
  canEnterZenReason?: CanEnterZenReason
  onEnterZen?: () => void
}) {
  const todayLabel = formatHeroDate(props.currentDate)
  const greeting = getTimeOfDayGreeting(props.currentDate)

  return (
    <section className="hero-row" aria-label="Today overview">
      <div className="hero-copy">
        <span className="eyebrow">{todayLabel}</span>
        <h1 tabIndex={-1}>{greeting}</h1>
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
      <div className="hero-tools">
        {props.onDensityChange && props.onEnterZen ? (
          <DashboardModeControl
            density={props.density ?? 'comfortable'}
            onDensityChange={props.onDensityChange}
            canEnterZen={props.canEnterZen ?? false}
            canEnterZenReason={props.canEnterZenReason}
            onEnterZen={props.onEnterZen}
            compact
            idPrefix="hero-mode"
          />
        ) : null}
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
      </div>
    </section>
  )
}
