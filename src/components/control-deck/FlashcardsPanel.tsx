import { useSettingsPanel } from './SettingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { ToggleSetting } from '../shared/settings/ToggleSetting'
import { STUDY_FLASHCARDS_RESET_KEYS } from '../../lib/settings/settingsSections'
import { useConfirm } from '../../context/useConfirm'

export function FlashcardsPanel() {
  const { flashcardsEnabled, updateSetting, resetKeys } = useSettingsPanel()
  const { requestConfirm } = useConfirm()

  const handleReset = async () => {
    const ok = await requestConfirm({
      title: 'Reset flashcards settings?',
      message: 'Restores the default flashcards enabled state (disabled for new installs).',
      confirmLabel: 'Reset',
    })
    if (!ok) return
    void resetKeys(STUDY_FLASHCARDS_RESET_KEYS, 'Flashcards settings restored')
  }

  return (
    <SettingsCard
      id="settings-flashcards"
      title="Flashcards Settings"
      onResetDefaults={() => void handleReset()}
    >
      <ToggleSetting
        label="Enable flashcards"
        description="Optional recall deck with spaced repetition. Card data stays in backups when disabled."
        checked={flashcardsEnabled}
        onChange={v => updateSetting('flashcardsEnabled', v)}
      />
    </SettingsCard>
  )
}
