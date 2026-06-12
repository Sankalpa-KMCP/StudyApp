import { useEffect } from 'react'
import { readAppHashFromLocation } from '../lib/appHashRouting'
import { scrollToSettingsSectionWhenReady, consumePendingSettingsPanelScroll } from '../lib/settingsSections'
import { useConfirm } from '../context/useConfirm'
import { AestheticsPanel } from './control-deck/AestheticsPanel'
import { FlashcardsPanel } from './control-deck/FlashcardsPanel'
import { NotesSettingsPanel } from './control-deck/NotesSettingsPanel'
import { TimerFocusPanel } from './control-deck/TimerFocusPanel'
import { SoundFeedbackPanel } from './control-deck/SoundFeedbackPanel'
import { AlgorithmPanel } from './control-deck/AlgorithmPanel'
import { ZenLockoutPanel } from './control-deck/ZenLockoutPanel'
import { BackupVaultPanel } from './control-deck/BackupVaultPanel'
import { DesktopSettingsPanel } from './control-deck/DesktopSettingsPanel'
import { CategoriesPanel } from './control-deck/CategoriesPanel'
import { SettingsOnboardingBanners } from './control-deck/SettingsOnboardingBanners'
import { SettingsPanelProvider, useSettingsPanel } from './control-deck/SettingsPanelContext'
import { SettingsShell, SettingsSection } from './control-deck/SettingsShell'

interface ControlDeckProps {
  onShowOnboarding?: () => void
}

function ControlDeckContent({ onShowOnboarding }: ControlDeckProps) {
  const { dailyGoalMinutes, flashcardsEnabled, resetSectionDefaults } = useSettingsPanel()
  const { requestConfirm } = useConfirm()

  useEffect(() => {
    const { settingsSection } = readAppHashFromLocation()
    const pending = consumePendingSettingsPanelScroll()
    const targetId = pending ?? (settingsSection ? `settings-${settingsSection}` : null)
    if (targetId) {
      scrollToSettingsSectionWhenReady(targetId)
    }
  }, [])

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
      dailyGoalMinutes={dailyGoalMinutes}
      flashcardsEnabled={flashcardsEnabled}
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
        <FlashcardsPanel />
        <NotesSettingsPanel />
        <AlgorithmPanel />
        <CategoriesPanel />
      </SettingsSection>

      <SettingsSection id="data" label="Data">
        <BackupVaultPanel />
        <DesktopSettingsPanel />
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
