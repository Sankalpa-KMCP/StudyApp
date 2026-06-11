import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useConfirm } from '../context/useConfirm'
import { AestheticsPanel } from './control-deck/AestheticsPanel'
import { NotesSettingsPanel } from './control-deck/NotesSettingsPanel'
import { TimerFocusPanel } from './control-deck/TimerFocusPanel'
import { SoundFeedbackPanel } from './control-deck/SoundFeedbackPanel'
import { AlgorithmPanel } from './control-deck/AlgorithmPanel'
import { ZenLockoutPanel } from './control-deck/ZenLockoutPanel'
import { BackupVaultPanel } from './control-deck/BackupVaultPanel'
import { CategoriesPanel } from './control-deck/CategoriesPanel'
import { SettingsPanelProvider, useSettingsPanel } from './control-deck/SettingsPanelContext'
import { SettingsShell, SettingsSection, scrollToSettingsSection } from './control-deck/SettingsShell'
import { SettingsCard } from './shared/settings/SettingsCard'

interface ControlDeckProps {
  onShowOnboarding?: () => void
}

function ControlDeckContent({ onShowOnboarding }: ControlDeckProps) {
  const { dailyGoalMinutes, resetSectionDefaults } = useSettingsPanel()
  const { requestConfirm } = useConfirm()

  const [startHereDismissed, setStartHereDismissed] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem('settings_start_here_dismissed'),
  )
  const [goalNudgeDismissed, setGoalNudgeDismissed] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem('goal_nudge_dismissed'),
  )
  const showHighGoalNudge = !goalNudgeDismissed && dailyGoalMinutes >= 480

  const dismissStartHere = () => {
    localStorage.setItem('settings_start_here_dismissed', 'true')
    setStartHereDismissed(true)
  }

  const handleSectionReset = async (sectionId: 'appearance' | 'focus' | 'study' | 'data') => {
    const ok = await requestConfirm({
      title: 'Reset section defaults?',
      message: 'Restores all settings in this section to their original values.',
      confirmLabel: 'Reset',
    })
    if (!ok) return
    void resetSectionDefaults(sectionId)
  }

  const banners = (
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
              onClick={() => {
                localStorage.setItem('goal_nudge_dismissed', 'true')
                setGoalNudgeDismissed(true)
              }}
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
            <button
              type="button"
              onClick={() => scrollToSettingsSection('settings-study')}
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
            onClick={dismissStartHere}
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

  return (
    <SettingsShell banners={banners}>
      <SettingsSection id="appearance" label="Appearance">
        <AestheticsPanel />
      </SettingsSection>

      <SettingsSection
        id="focus"
        label="Focus"
        onResetDefaults={() => void handleSectionReset('focus')}
      >
        <TimerFocusPanel />
        <SoundFeedbackPanel />
        <ZenLockoutPanel />
      </SettingsSection>

      <SettingsSection
        id="study"
        label="Study"
        onResetDefaults={() => void handleSectionReset('study')}
      >
        <NotesSettingsPanel />
        <AlgorithmPanel />
        <CategoriesPanel />
      </SettingsSection>

      <SettingsSection id="data" label="Data">
        <BackupVaultPanel />
      </SettingsSection>
    </SettingsShell>
  )
}

export function ControlDeck({ onShowOnboarding }: ControlDeckProps) {
  return (
    <SettingsPanelProvider>
      <ControlDeckContent onShowOnboarding={onShowOnboarding} />
    </SettingsPanelProvider>
  )
}
