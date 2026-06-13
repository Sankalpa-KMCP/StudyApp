import { useTranslation } from '../../i18n/useTranslation'
import { getSharedAudioContext, type AmbientPreset } from '../../lib/audio/ambientAudio'
import { useSettingsPanel } from './SettingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { ToggleSetting } from '../shared/settings/ToggleSetting'
import { SettingsPresetChips } from '../shared/settings/SettingsPresetChips'
import { RangeSetting } from '../shared/settings/RangeSetting'

const FONT_OPTIONS = ['JetBrains Mono', 'Inter', 'Outfit'] as const

export function SoundFeedbackPanel() {
  const { t } = useTranslation()
  const {
    soundEnabled,
    tactile_feedback: tactileEnabled,
    developer_font: developerFont,
    ambientSoundEnabled,
    ambientSoundPreset,
    ambientVolume,
    updateSetting,
  } = useSettingsPanel()

  const ambientPresets: { value: number; label: string; preset: AmbientPreset }[] = [
    { value: 0, label: t('soundAmbientRain'), preset: 'rain' },
    { value: 1, label: t('soundAmbientWhiteNoise'), preset: 'white-noise' },
    { value: 2, label: t('soundAmbientCafe'), preset: 'cafe' },
    { value: 3, label: t('soundAmbientBrownNoise'), preset: 'brown-noise' },
  ]

  const handleAmbientToggle = (enabled: boolean) => {
    if (enabled) getSharedAudioContext()
    updateSetting('ambientSoundEnabled', enabled)
  }

  const activePresetValue = ambientPresets.find(p => p.preset === ambientSoundPreset)?.value ?? 0

  return (
    <SettingsCard id="settings-sound-feedback" title={t('soundPanelTitle')} defaultCollapsed>
      <div className="space-y-4">
        <ToggleSetting label={t('soundSessionChimes')} checked={soundEnabled} onChange={v => updateSetting('soundEnabled', v)} />
        <ToggleSetting label={t('soundTactileFeedback')} checked={tactileEnabled} onChange={v => updateSetting('tactile_feedback', v)} />

        <div className="border-t border-[var(--color-border-card)] pt-4 space-y-3">
          <ToggleSetting
            label={t('soundAmbientBackground')}
            description={t('soundAmbientBackgroundDesc')}
            checked={ambientSoundEnabled}
            onChange={handleAmbientToggle}
          />
          {ambientSoundEnabled && (
            <>
              <SettingsPresetChips
                presets={ambientPresets.map(p => ({ value: p.value, label: p.label }))}
                activeValue={activePresetValue}
                onSelect={v => updateSetting('ambientSoundPreset', ambientPresets.find(p => p.value === v)?.preset ?? 'rain')}
                unit=""
              />
              <RangeSetting
                label={t('soundAmbientVolume')}
                value={ambientVolume}
                min={0}
                max={100}
                step={5}
                unit="%"
                onChange={v => updateSetting('ambientVolume', v)}
              />
            </>
          )}
        </div>

        <div>
          <span className="settings-label block mb-2">{t('soundMonospaceFont')}</span>
          <select
            value={developerFont}
            onChange={e => updateSetting('developer_font', e.target.value)}
            className="settings-select"
          >
            {FONT_OPTIONS.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <p className="settings-muted mt-1.5">{t('soundMonospaceFontHelper')}</p>
        </div>
      </div>
    </SettingsCard>
  )
}
