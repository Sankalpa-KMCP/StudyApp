import { Sparkles } from 'lucide-react'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { scrollToSettingsSection } from '../../lib/settingsSections'

interface SettingsOnboardingBannersProps {
  showHighGoalNudge: boolean
  startHereDismissed: boolean
  flashcardsEnabled: boolean
  onDismissGoalNudge: () => void
  onDismissStartHere: () => void
  onShowOnboarding?: () => void
}

export function SettingsOnboardingBanners({
  showHighGoalNudge,
  startHereDismissed,
  flashcardsEnabled,
  onDismissGoalNudge,
  onDismissStartHere,
  onShowOnboarding,
}: SettingsOnboardingBannersProps) {
  return (
    <>
      {showHighGoalNudge && (
        <SettingsCard title="Daily goal tip">
          <p className="settings-muted leading-relaxed">
            8h is a lot for day one—try 2h? You can lower your daily goal in Timer &amp; Focus.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={() => scrollToSettingsSection('settings-focus')}
              className="text-xs font-semibold text-accent-blue hover:text-accent-blue/80"
            >
              Adjust daily goal
            </button>
            <button
              type="button"
              onClick={onDismissGoalNudge}
              className="text-xs font-semibold settings-muted hover:text-[var(--color-text-primary)]"
            >
              Dismiss
            </button>
          </div>
        </SettingsCard>
      )}
      {!startHereDismissed && (
        <SettingsCard title="Start here">
          <p className="settings-muted leading-relaxed mb-3">
            Three essentials to set up your sanctuary on day one.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => scrollToSettingsSection('settings-focus')}
              className="text-left text-xs font-semibold text-accent-blue hover:text-accent-blue/80 transition-colors"
            >
              Daily goal → Timer & Focus
            </button>
            {!flashcardsEnabled && (
              <button
                type="button"
                onClick={() => scrollToSettingsSection('settings-flashcards')}
                className="text-left text-xs font-semibold text-accent-blue hover:text-accent-blue/80 transition-colors"
              >
                Flashcards (optional) → enable recall deck
              </button>
            )}
            <button
              type="button"
              onClick={() => scrollToSettingsSection('settings-categories')}
              className="text-left text-xs font-semibold text-accent-blue hover:text-accent-blue/80 transition-colors"
            >
              Subject categories → organize your tasks
            </button>
            <button
              type="button"
              onClick={() => scrollToSettingsSection('settings-data')}
              className="text-left text-xs font-semibold text-accent-blue hover:text-accent-blue/80 transition-colors"
            >
              Export backup → keep your data safe
            </button>
          </div>
          <button
            type="button"
            onClick={onDismissStartHere}
            className="mt-4 text-micro font-semibold settings-muted hover:text-[var(--color-text-primary)] transition-colors"
          >
            Dismiss
          </button>
        </SettingsCard>
      )}
      {onShowOnboarding && (
        <SettingsCard id="settings-getting-started" title="Getting Started">
          <button
            type="button"
            onClick={onShowOnboarding}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[color-mix(in_srgb,var(--color-surface-card)_60%,transparent)] transition-all ios-active-scale"
          >
            <Sparkles className="h-4 w-4 text-accent-blue shrink-0" />
            <span>Replay the Getting Started tour</span>
          </button>
        </SettingsCard>
      )}
    </>
  )
}
