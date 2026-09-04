import type { DensityMode } from '../hooks/useDensityPreference'
import type { CanEnterZenReason } from '../hooks/useFocusSession'

export type DashboardModeControlProps = {
  density: DensityMode
  onDensityChange: (density: DensityMode) => void
  canEnterZen: boolean
  canEnterZenReason?: CanEnterZenReason
  onEnterZen: () => void
  compact?: boolean
  idPrefix?: string
}

export function DashboardModeControl({
  density,
  onDensityChange,
  canEnterZen,
  canEnterZenReason = 'no-session',
  onEnterZen,
  compact = false,
  idPrefix = 'dashboard-mode',
}: DashboardModeControlProps) {
  const getZenTitle = () => {
    if (canEnterZen) return 'Open Zen focus mode'
    if (canEnterZenReason === 'stale') return 'Resolve unfinished session to use Zen mode'
    if (canEnterZenReason === 'pending') return 'Focus is updating'
    return 'Zen mode requires an active focus session'
  }

  return (
    <div
      className={`segmented-control dashboard-mode-control ${compact ? 'is-compact' : ''}`}
      role="group"
      aria-label="Dashboard mode"
    >
      <button
        id={`${idPrefix}-comfortable`}
        type="button"
        className={density === 'comfortable' ? 'is-active' : ''}
        aria-pressed={density === 'comfortable'}
        onClick={() => onDensityChange('comfortable')}
      >
        Comfortable
      </button>
      <button
        id={`${idPrefix}-compact`}
        type="button"
        className={density === 'compact' ? 'is-active' : ''}
        aria-pressed={density === 'compact'}
        onClick={() => onDensityChange('compact')}
      >
        Compact
      </button>
      <button
        id={`${idPrefix}-zen`}
        type="button"
        className="dashboard-mode-zen"
        disabled={!canEnterZen}
        title={getZenTitle()}
        onClick={canEnterZen ? onEnterZen : undefined}
      >
        Zen
        {!canEnterZen ? (
          <span className="sr-only"> ({getZenTitle()})</span>
        ) : null}
      </button>
    </div>
  )
}
