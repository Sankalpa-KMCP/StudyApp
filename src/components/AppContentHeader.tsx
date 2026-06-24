import { memo, useId } from 'react'
import { Brain, FileText, Flame, Lock, Search } from 'lucide-react'
import type { ActiveTab } from '../types/app'
import { getTabChrome } from '../navigation/appNav'
import { useTranslation } from '../i18n/useTranslation'
import { getDailyFocusStatus } from '../lib/study/studyDashboard'
import { MobileHeaderMenu } from './MobileHeaderMenu'

interface AppContentHeaderProps {
  activeTab: ActiveTab
  isTimerActive: boolean
  timerMode: 'study' | 'break'
  todayStudyMinutes: number
  dailyGoalMinutes: number
  focusCategoryName?: string
  currentStreak: number
  level: number
  xpProgressPercent: number
  enforceLockout: boolean
  onOpenNotes?: () => void
  onNavigateToAnalytics?: () => void
  onShowOnboarding?: () => void
  onOpenHotkeys?: () => void
  onOpenCommandPalette?: () => void
}

export const AppContentHeader = memo(function AppContentHeader({
  activeTab,
  isTimerActive,
  timerMode,
  todayStudyMinutes,
  dailyGoalMinutes,
  focusCategoryName,
  currentStreak,
  level,
  xpProgressPercent,
  enforceLockout,
  onOpenNotes,
  onNavigateToAnalytics,
  onShowOnboarding,
  onOpenHotkeys,
  onOpenCommandPalette,
}: AppContentHeaderProps) {
  const { t } = useTranslation()
  const goalTooltipId = useId()
  const tabChrome = getTabChrome()
  const focusStatus = getDailyFocusStatus(todayStudyMinutes, dailyGoalMinutes)
  const goalScopeLabel = focusCategoryName ? `${focusCategoryName} goal` : 'Daily goal'
  const goalDetailTooltip = `${focusStatus.studiedLabel} / ${formatGoalLabel(dailyGoalMinutes)} (${goalScopeLabel}). Change daily goal in Settings → Timer & Focus.`
  const statsTooltip = `${currentStreak}-day streak · Level ${level} · ${Math.round(xpProgressPercent)}% XP to next level`
  const goalProgressPercent = Math.round(focusStatus.percent * 100)

  const goalLabel = focusStatus.goalMet ? 'Goal met' : focusStatus.remainingLabel
  const showLockoutStrip = enforceLockout && isTimerActive && timerMode === 'study'
  const showTimerPill = isTimerActive && !showLockoutStrip

  const focusChip = (
    <div
      aria-describedby={goalTooltipId}
      className={`header-goal-chip border ${
        focusStatus.goalMet
          ? 'bg-accent-green/10 border-accent-green/20'
          : 'bg-accent-blue/10 border-accent-blue/20'
      }`}
    >
      <span id={goalTooltipId} className="sr-only">{goalDetailTooltip}</span>
      <span className={`text-label font-mono font-bold leading-tight ${focusStatus.goalMet ? 'text-accent-green' : 'text-accent-blue'}`}>
        {goalLabel}
      </span>
      <div
        role="progressbar"
        aria-valuenow={goalProgressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={goalScopeLabel}
        className="h-1.5 w-full rounded-full surface-track overflow-hidden"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${focusStatus.goalMet ? 'bg-accent-green' : 'bg-accent-blue'}`}
          style={{ width: `${goalProgressPercent}%` }}
        />
      </div>
    </div>
  )

  const timerPill = showTimerPill ? (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-1.5 rounded-full bg-accent-blue/10 border border-accent-blue/20 px-3 py-1.5"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent-blue animate-pulse" aria-hidden />
      <span className="text-micro md:text-label font-semibold text-accent-blue">
        {timerMode === 'study' ? 'Study timer running' : 'Break timer running'}
      </span>
    </div>
  ) : null

  const lockoutStrip = showLockoutStrip ? (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-1.5 rounded-lg border border-accent-amber/20 bg-accent-amber/8 px-3 py-1.5 w-full md:w-auto"
    >
      <Lock className="h-3 w-3 text-accent-amber shrink-0" aria-hidden />
      <span className="text-micro font-semibold text-accent-amber">{t('pauseTimerToLeave')}</span>
    </div>
  ) : null

  const mobileStatsChip = onNavigateToAnalytics ? (
    <button
      type="button"
      onClick={onNavigateToAnalytics}
      title={statsTooltip}
      aria-label={`${statsTooltip}. Open analytics.`}
      className="header-stat-chip ios-active-scale"
    >
      <Flame className="h-3.5 w-3.5 text-accent-amber shrink-0" aria-hidden />
      <span className="text-micro font-bold text-primary">{currentStreak}</span>
      <span className="rounded-full surface-track px-1.5 py-0.5 text-micro font-bold text-primary">
        LVL {level}
      </span>
    </button>
  ) : null

  return (
    <header className="flex flex-col px-4 md:px-6 lg:px-8 py-2.5 md:py-4 border-b border-card surface-subtle backdrop-blur-md gap-2">
      <div className="flex items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-2 min-w-0 md:select-none">
          <Brain className="h-4 w-4 text-accent-blue shrink-0 md:hidden" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-title font-display text-gradient-accent truncate">{tabChrome[activeTab].title}</h2>
            <p className="text-caption text-muted font-medium truncate md:mt-1">{tabChrome[activeTab].subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2.5 shrink-0">
          {onOpenNotes && (
            <button
              type="button"
              onClick={onOpenNotes}
              aria-label="Quick Notes"
              className="chrome-icon-btn chrome-icon-btn--sm md:hidden"
            >
              <FileText className="h-4 w-4" />
            </button>
          )}
          {onOpenHotkeys && onOpenCommandPalette && (
            <div className="md:hidden">
              <MobileHeaderMenu
                onShowOnboarding={onShowOnboarding}
                onOpenHotkeys={onOpenHotkeys}
                onOpenCommandPalette={onOpenCommandPalette}
              />
            </div>
          )}
          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              aria-label="Search app (Ctrl+K)"
              title="Search app (Ctrl+K)"
              className="chrome-icon-btn chrome-icon-btn--md hidden md:inline-flex"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:hidden">
          {mobileStatsChip}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          {focusChip}
          {timerPill}
          {lockoutStrip}
        </div>
      </div>
    </header>
  )
})

function formatGoalLabel(goalMinutes: number): string {
  if (goalMinutes <= 0) return '—'
  const hours = Math.floor(goalMinutes / 60)
  const mins = goalMinutes % 60
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`
  if (hours > 0) return `${hours}h`
  return `${mins}m`
}
