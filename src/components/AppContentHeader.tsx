import { Brain, FileText } from 'lucide-react'
import type { ActiveTab } from '../types/app'
import { TAB_CHROME } from '../navigation/appNav'
import { getDailyFocusStatus } from '../lib/studyDashboard'

interface AppContentHeaderProps {
  activeTab: ActiveTab
  isTimerActive: boolean
  timerMode: 'study' | 'break'
  todayStudyMinutes: number
  dailyGoalMinutes: number
  focusCategoryName?: string
  onOpenNotes?: () => void
}

export function AppContentHeader({
  activeTab,
  isTimerActive,
  timerMode,
  todayStudyMinutes,
  dailyGoalMinutes,
  focusCategoryName,
  onOpenNotes,
}: AppContentHeaderProps) {
  const focusStatus = getDailyFocusStatus(todayStudyMinutes, dailyGoalMinutes)
  const goalScopeLabel = focusCategoryName ? `${focusCategoryName} goal` : 'Daily goal'
  const goalDetailTooltip = `${focusStatus.studiedLabel} / ${formatGoalLabel(dailyGoalMinutes)} (${goalScopeLabel}). Change daily goal in Settings → Timer & Focus.`

  const goalLabel = focusStatus.goalMet ? 'Goal met' : focusStatus.remainingLabel

  const focusChip = (
    <div
      title={goalDetailTooltip}
      className={`flex flex-col gap-1 rounded-full border px-3 py-1.5 min-w-[100px] ${
        focusStatus.goalMet
          ? 'bg-accent-green/10 border-accent-green/20'
          : 'bg-accent-blue/10 border-accent-blue/20'
      }`}
    >
      <span className={`text-label font-mono font-bold leading-tight ${focusStatus.goalMet ? 'text-accent-green' : 'text-accent-blue'}`}>
        {goalLabel}
      </span>
      <div className="h-1.5 w-full rounded-full surface-track overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${focusStatus.goalMet ? 'bg-accent-green' : 'bg-accent-blue'}`}
          style={{ width: `${Math.round(focusStatus.percent * 100)}%` }}
        />
      </div>
    </div>
  )

  return (
    <>
      <header className="flex md:hidden flex-col px-4 py-2.5 border-b border-card surface-subtle backdrop-blur-md gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Brain className="h-4 w-4 text-accent-blue shrink-0" />
            <div className="min-w-0">
              <span className="font-bold text-sm text-gradient-accent truncate block">{TAB_CHROME[activeTab].title}</span>
              <p className="text-caption text-muted font-medium truncate">{TAB_CHROME[activeTab].subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenNotes && (
              <button
                type="button"
                onClick={onOpenNotes}
                aria-label="Quick Notes"
                className="flex h-8 w-8 items-center justify-center rounded-full surface-subtle border border-card text-muted hover:text-primary hover:surface-track transition-all ios-active-scale"
              >
                <FileText className="h-4 w-4" />
              </button>
            )}
            {focusChip}
          </div>
        </div>
        {isTimerActive && (
          <div role="status" aria-live="polite" className="flex items-center gap-1.5 pl-6">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-blue animate-pulse" aria-hidden />
            <span className="text-micro font-semibold text-accent-blue">
              {timerMode === 'study' ? 'Study timer running' : 'Break timer running'}
            </span>
          </div>
        )}
      </header>

      <header className="hidden md:flex items-center justify-between px-6 lg:px-8 py-4 border-b border-card surface-subtle backdrop-blur-md">
        <div className="select-none">
          <h2 className="text-base font-bold text-gradient-accent tracking-wide">{TAB_CHROME[activeTab].title}</h2>
          <p className="text-caption text-muted font-medium mt-1">{TAB_CHROME[activeTab].subtitle}</p>
        </div>
        <div className="flex items-center gap-2.5">
          {focusChip}
          {isTimerActive && (
            <div className="flex items-center gap-1.5 rounded-full bg-accent-blue/10 border border-accent-blue/20 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-blue animate-pulse" />
              <span className="text-label font-semibold text-accent-blue">
                {timerMode === 'study' ? 'Study timer running' : 'Break timer running'}
              </span>
            </div>
          )}
        </div>
      </header>
    </>
  )
}

function formatGoalLabel(goalMinutes: number): string {
  if (goalMinutes <= 0) return '—'
  const hours = Math.floor(goalMinutes / 60)
  const mins = goalMinutes % 60
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`
  if (hours > 0) return `${hours}h`
  return `${mins}m`
}
