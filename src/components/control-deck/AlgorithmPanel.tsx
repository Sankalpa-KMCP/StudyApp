import { useConfirm } from '../../context/useConfirm'
import { STUDY_ALGORITHM_RESET_KEYS } from '../../lib/settings/settingsSections'
import { useSettingsPanel } from './SettingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { RangeSetting } from '../shared/settings/RangeSetting'

export function AlgorithmPanel() {
  const { initialEasinessFactor, schedulingAlgorithm, flashcardsEnabled, updateSetting, resetKeys } = useSettingsPanel()
  const { requestConfirm } = useConfirm()

  const handleReset = async () => {
    const ok = await requestConfirm({
      title: 'Reset algorithm settings?',
      message: 'Restores the default initial easiness factor (2.5) and SM-2 algorithm.',
      confirmLabel: 'Reset',
    })
    if (!ok) return
    void resetKeys(STUDY_ALGORITHM_RESET_KEYS, 'Algorithm settings restored')
  }

  return (
    <SettingsCard
      id="settings-algorithm"
      title="Spaced Repetition"
      defaultCollapsed
      onResetDefaults={() => void handleReset()}
      description={
        flashcardsEnabled
          ? 'Choose SM-2 or FSRS scheduling for study subjects and flashcards.'
          : 'Choose SM-2 or FSRS scheduling for study subjects.'
      }
    >
      <div className="mb-4">
        <span className="settings-label block mb-2">Scheduling algorithm</span>
        <div className="flex gap-2">
          {(['sm2', 'fsrs'] as const).map(algo => (
            <button
              key={algo}
              type="button"
              onClick={() => updateSetting('schedulingAlgorithm', algo)}
              className={`rounded-full px-3 py-1.5 text-micro font-semibold border transition-all ${
                schedulingAlgorithm === algo
                  ? 'border-accent-purple/40 text-accent-purple bg-accent-purple/10'
                  : 'border-white/10 settings-muted hover:border-white/20'
              }`}
            >
              {algo.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
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
