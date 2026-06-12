import { useEffect, useState } from 'react'
import { readAppHashFromLocation } from '../lib/appHashRouting'
import { scrollToSettingsSection } from '../lib/settingsSections'
import { useConfirm } from '../context/useConfirm'
import { AestheticsPanel } from './control-deck/AestheticsPanel'
import { NotesSettingsPanel } from './control-deck/NotesSettingsPanel'
import { TimerFocusPanel } from './control-deck/TimerFocusPanel'
import { SoundFeedbackPanel } from './control-deck/SoundFeedbackPanel'
import { AlgorithmPanel } from './control-deck/AlgorithmPanel'
import { ZenLockoutPanel } from './control-deck/ZenLockoutPanel'
import { BackupVaultPanel } from './control-deck/BackupVaultPanel'
import { CategoriesPanel } from './control-deck/CategoriesPanel'
import { SettingsOnboardingBanners } from './control-deck/SettingsOnboardingBanners'
import { SettingsPanelProvider, useSettingsPanel } from './control-deck/SettingsPanelContext'
import { SettingsShell, SettingsSection } from './control-deck/SettingsShell'

interface ControlDeckProps {
  onShowOnboarding?: () => void
}

function ControlDeckContent({ onShowOnboarding }: ControlDeckProps) {
  const { dailyGoalMinutes, resetSectionDefaults } = useSettingsPanel()
  const { requestConfirm } = useConfirm()

  useEffect(() => {
    const { settingsSection } = readAppHashFromLocation()
    if (settingsSection) {
      requestAnimationFrame(() => {
        scrollToSettingsSection(`settings-${settingsSection}`)
      })
    }
  }, [])

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
    <SettingsOnboardingBanners
      showHighGoalNudge={showHighGoalNudge}
      startHereDismissed={startHereDismissed}
      onDismissGoalNudge={() => {
        localStorage.setItem('goal_nudge_dismissed', 'true')
        setGoalNudgeDismissed(true)
      }}
      onDismissStartHere={dismissStartHere}
      onShowOnboarding={onShowOnboarding}
    />
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
