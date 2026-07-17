import { useConfirm } from '../../context/useConfirm'
import { STUDY_ALGORITHM_RESET_KEYS } from '../../lib/settings/settingsSections'
import { useTranslation } from '../../i18n/useTranslation'
import { useSettingsPanel } from '../../context/settingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { RangeSetting } from '../shared/settings/RangeSetting'

export function AlgorithmPanel() {
  const { t } = useTranslation()
  const { initialEasinessFactor, schedulingAlgorithm, updateSetting, resetKeys } = useSettingsPanel()
  const { requestConfirm } = useConfirm()

  const handleReset = async () => {
    const ok = await requestConfirm({
      title: t('algorithmResetConfirmTitle'),
      message: t('algorithmResetConfirmMessage'),
      confirmLabel: t('algorithmResetConfirmLabel'),
    })
    if (!ok) return
    void resetKeys(STUDY_ALGORITHM_RESET_KEYS, t('algorithmSettingsRestored'))
  }

  return (
    <SettingsCard
      id="settings-algorithm"
      title={t('algorithmPanelTitle')}
      defaultCollapsed
      onResetDefaults={() => void handleReset()}
      description={t('algorithmPanelDescription')}
    >
      <div className="mb-4">
        <span className="settings-label block mb-2">{t('algorithmSchedulingAlgorithm')}</span>
        <div className="flex gap-2">
          {(['sm2', 'fsrs'] as const).map(algo => (
            <button
              key={algo}
              type="button"
              onClick={() => updateSetting('schedulingAlgorithm', algo)}
              className={`rounded-full px-3 py-1.5 text-micro font-semibold border transition-all ${
                schedulingAlgorithm === algo
                  ? 'border-accent-purple/40 text-accent-purple bg-accent-purple/10'
                  : 'border-card settings-muted hover:border-card'
              }`}
            >
              {algo.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <RangeSetting
        label={t('algorithmInitialEasinessFactor')}
        value={initialEasinessFactor}
        min={1.3}
        max={3.5}
        step={0.1}
        onChange={v => updateSetting('initialEasinessFactor', v)}
      />
    </SettingsCard>
  )
}
