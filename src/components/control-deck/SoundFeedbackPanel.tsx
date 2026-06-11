import { getSharedAudioContext } from '../../lib/ambientAudio'
import { useSettingsPanel } from './SettingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { ToggleSetting } from '../shared/settings/ToggleSetting'
import { SettingsPresetChips } from '../shared/settings/SettingsPresetChips'

const FONT_OPTIONS = ['JetBrains Mono', 'Inter', 'Outfit'] as const

const AMBIENT_PRESETS = [
  { value: 0, label: 'Rain', preset: 'rain' as const },
  { value: 1, label: 'White noise', preset: 'white-noise' as const },
]

export function SoundFeedbackPanel() {
  const {
    soundEnabled,
    tactile_feedback: tactileEnabled,
    developer_font: developerFont,
    ambientSoundEnabled,
    ambientSoundPreset,
    updateSetting,
  } = useSettingsPanel()

  const handleAmbientToggle = (enabled: boolean) => {
    if (enabled) getSharedAudioContext()
    updateSetting('ambientSoundEnabled', enabled)
  }

  return (
    <SettingsCard id="settings-sound-feedback" title="Sound & Feedback">
      <div className="space-y-4">
        <ToggleSetting label="Session chimes" checked={soundEnabled} onChange={v => updateSetting('soundEnabled', v)} />
        <ToggleSetting label="Tactile click feedback" checked={tactileEnabled} onChange={v => updateSetting('tactile_feedback', v)} />

        <div className="border-t border-[var(--color-border-card)] pt-4 space-y-3">
          <ToggleSetting
            label="Ambient background"
            description="Soft loop during active study blocks only"
            checked={ambientSoundEnabled}
            onChange={handleAmbientToggle}
          />
          {ambientSoundEnabled && (
            <SettingsPresetChips
              presets={AMBIENT_PRESETS.map(p => ({ value: p.value, label: p.label }))}
              activeValue={ambientSoundPreset === 'white-noise' ? 1 : 0}
              onSelect={v => updateSetting('ambientSoundPreset', AMBIENT_PRESETS.find(p => p.value === v)?.preset ?? 'rain')}
              unit=""
            />
          )}
        </div>

        <div>
          <span className="settings-label block mb-2">Monospace font</span>
          <select
            value={developerFont}
            onChange={e => updateSetting('developer_font', e.target.value)}
            className="settings-select"
          >
            {FONT_OPTIONS.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <p className="settings-muted mt-1.5">Timer and metrics use the loaded monospace fonts above.</p>
        </div>
      </div>
    </SettingsCard>
  )
}
