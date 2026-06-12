import { useConfirm } from '../../context/useConfirm'
import { STUDY_ALGORITHM_RESET_KEYS } from '../../lib/settingsSections'
import { useSettingsPanel } from './SettingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { RangeSetting } from '../shared/settings/RangeSetting'

export function AlgorithmPanel() {
  const { initialEasinessFactor, flashcardsEnabled, updateSetting, resetKeys } = useSettingsPanel()
  const { requestConfirm } = useConfirm()

  const handleReset = async () => {
    const ok = await requestConfirm({
      title: 'Reset algorithm settings?',
      message: 'Restores the default initial easiness factor (2.5).',
      confirmLabel: 'Reset',
    })
    if (!ok) return
    void resetKeys(STUDY_ALGORITHM_RESET_KEYS, 'Algorithm settings restored')
  }

  return (
    <SettingsCard
      id="settings-algorithm"
      title="Spaced Repetition (SM-2)"
      defaultCollapsed
      onResetDefaults={() => void handleReset()}
      description={
        flashcardsEnabled
          ? 'Adjust default SM-2 parameters for study subjects and flashcards. Higher EF means items stay easier longer after a good grade (2.5 is typical).'
          : 'Adjust default SM-2 parameters for study subjects. Higher EF means subjects stay easier longer after a good grade (2.5 is typical).'
      }
    >
      <RangeSetting
        label="Initial Easiness Factor (EF)"
        value={initialEasinessFactor}
        min={1.3}
        max={3.5}
        step={0.1}
        onChange={v => updateSetting('initialEasinessFactor', v)}
      />
    </SettingsCard>
  )
}
