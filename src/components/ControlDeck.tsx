import { lazy, Suspense, useEffect } from 'react'
import { readAppHashFromLocation } from '../lib/routing/appHashRouting'
import { scrollToSettingsSectionWhenReady, consumePendingSettingsPanelScroll } from '../lib/settings/settingsSections'
import { useConfirm } from '../context/useConfirm'

const AestheticsPanel = lazy(() => import('./control-deck/AestheticsPanel').then(m => ({ default: m.AestheticsPanel })))
const FlashcardsPanel = lazy(() => import('./control-deck/FlashcardsPanel').then(m => ({ default: m.FlashcardsPanel })))
const NotesSettingsPanel = lazy(() => import('./control-deck/NotesSettingsPanel').then(m => ({ default: m.NotesSettingsPanel })))
const TimerFocusPanel = lazy(() => import('./control-deck/TimerFocusPanel').then(m => ({ default: m.TimerFocusPanel })))
const SoundFeedbackPanel = lazy(() => import('./control-deck/SoundFeedbackPanel').then(m => ({ default: m.SoundFeedbackPanel })))
const AlgorithmPanel = lazy(() => import('./control-deck/AlgorithmPanel').then(m => ({ default: m.AlgorithmPanel })))
const ZenLockoutPanel = lazy(() => import('./control-deck/ZenLockoutPanel').then(m => ({ default: m.ZenLockoutPanel })))
const BackupVaultPanel = lazy(() => import('./control-deck/BackupVaultPanel').then(m => ({ default: m.BackupVaultPanel })))
const DesktopSettingsPanel = lazy(() => import('./control-deck/DesktopSettingsPanel').then(m => ({ default: m.DesktopSettingsPanel })))
const CategoriesPanel = lazy(() => import('./control-deck/CategoriesPanel').then(m => ({ default: m.CategoriesPanel })))

function PanelFallback() {
  return <div className="h-16 animate-pulse rounded-2xl surface-subtle" aria-hidden />
}
import { SettingsOnboardingBanners } from './control-deck/SettingsOnboardingBanners'
import { SettingsPanelProvider, useSettingsPanel } from './control-deck/SettingsPanelContext'
import { SettingsShell, SettingsSection } from './control-deck/SettingsShell'
import { useSettingsAdvancedMode } from '../hooks/useSettingsAdvancedMode'

interface ControlDeckProps {
  onShowOnboarding?: () => void
}

function ControlDeckContent({ onShowOnboarding }: ControlDeckProps) {
  const { dailyGoalMinutes, flashcardsEnabled, resetSectionDefaults } = useSettingsPanel()
  const { requestConfirm } = useConfirm()
  const { showAdvanced, setShowAdvanced } = useSettingsAdvancedMode()

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
    <SettingsShell
      banners={banners}
      showAdvanced={showAdvanced}
      onShowAdvancedChange={setShowAdvanced}
    >
      <SettingsSection id="appearance" label="Appearance">
        <Suspense fallback={<PanelFallback />}>
          <AestheticsPanel />
        </Suspense>
      </SettingsSection>

      <SettingsSection
        id="focus"
        label="Focus"
        onResetDefaults={() => void handleSectionReset('focus')}
      >
        <Suspense fallback={<PanelFallback />}>
          <TimerFocusPanel />
          <SoundFeedbackPanel />
          {showAdvanced && <ZenLockoutPanel />}
        </Suspense>
      </SettingsSection>

      <SettingsSection
        id="study"
        label="Study"
        onResetDefaults={() => void handleSectionReset('study')}
      >
        <Suspense fallback={<PanelFallback />}>
          <FlashcardsPanel />
          {showAdvanced && (
            <>
              <NotesSettingsPanel />
              <AlgorithmPanel />
              <CategoriesPanel />
            </>
          )}
        </Suspense>
      </SettingsSection>

      <SettingsSection id="data" label="Data">
        <Suspense fallback={<PanelFallback />}>
          <BackupVaultPanel />
          {showAdvanced && <DesktopSettingsPanel />}
        </Suspense>
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
