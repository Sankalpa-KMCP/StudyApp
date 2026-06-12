import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useConfirm } from '../../context/useConfirm'
import { APPEARANCE_ADVANCED_KEYS } from '../../lib/settings/settingsSections'
import { useSettingsPanel } from './SettingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { RangeSetting } from '../shared/settings/RangeSetting'
import { ThemeSwatchPicker } from './ThemeSwatchPicker'

const UI_FONT_OPTIONS = ['Inter', 'Outfit', 'System'] as const

export function AestheticsPanel() {
  const {
    theme,
    themePreset,
    lightThemePreset,
    ui_font: uiFont,
    uiDensity,
    cardOpacity,
    backdropBlur,
    backdropSaturate,
    cardBorderOpacity,
    accentBlueOverride,
    accentPurpleOverride,
    accentGreenOverride,
    accentAmberOverride,
    updateSetting,
    resetKeys,
  } = useSettingsPanel()
  const { requestConfirm } = useConfirm()
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const handleResetAdvanced = async () => {
    const ok = await requestConfirm({
      title: 'Reset glass & accents?',
      message: 'Restores translucency sliders and accent overrides to defaults.',
      confirmLabel: 'Reset',
    })
    if (!ok) return
    void resetKeys(APPEARANCE_ADVANCED_KEYS, 'Appearance advanced settings restored')
  }

  return (
    <SettingsCard id="settings-aesthetics" title="Aesthetics & Translucency">
      <div className="space-y-6">
        <ThemeSwatchPicker
          theme={theme}
          themePreset={themePreset}
          lightThemePreset={lightThemePreset}
          updateSetting={updateSetting}
        />

        <div>
          <span className="settings-label block mb-2">UI font</span>
          <select
            value={uiFont}
            onChange={e => updateSetting('ui_font', e.target.value)}
            className="settings-select"
          >
            {UI_FONT_OPTIONS.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div>
          <span className="settings-label block mb-2">UI density</span>
          <select
            value={uiDensity}
            onChange={e => updateSetting('uiDensity', e.target.value)}
            className="settings-select"
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </div>

        <div className="border-t border-[var(--color-border-card)] pt-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <button
              type="button"
              onClick={() => setAdvancedOpen(o => !o)}
              className="flex items-center gap-2 settings-label"
              aria-expanded={advancedOpen}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              Advanced glass & accents
            </button>
            <button
              type="button"
              onClick={() => void handleResetAdvanced()}
              className="text-micro font-semibold text-accent-blue hover:text-accent-blue/80"
            >
              Reset
            </button>
          </div>
          {advancedOpen && (
          <div className="space-y-4">
            <RangeSetting
              label="Card Backdrop Opacity"
              value={Math.round(cardOpacity * 100)}
              min={20}
              max={90}
              step={5}
              unit="%"
              onChange={v => updateSetting('cardOpacity', v / 100)}
            />
            <RangeSetting
              label="Frosting blur size"
              value={backdropBlur}
              min={4}
              max={24}
              step={1}
              unit="px"
              onChange={v => updateSetting('backdropBlur', v)}
            />
            <RangeSetting
              label="Glass saturation"
              value={backdropSaturate}
              min={100}
              max={200}
              step={5}
              unit="%"
              onChange={v => updateSetting('backdropSaturate', v)}
            />
            <RangeSetting
              label="Card border opacity"
              value={Math.round(cardBorderOpacity * 100)}
              min={4}
              max={16}
              step={1}
              unit="%"
              onChange={v => updateSetting('cardBorderOpacity', v / 100)}
            />

            <div>
              <span className="settings-label block mb-3">Accent overrides</span>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['accentBlueOverride', 'Blue', accentBlueOverride],
                  ['accentPurpleOverride', 'Purple', accentPurpleOverride],
                  ['accentGreenOverride', 'Green', accentGreenOverride],
                  ['accentAmberOverride', 'Amber', accentAmberOverride],
                ] as const).map(([key, label, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={value || '#3b82f6'}
                      onChange={e => updateSetting(key, e.target.value)}
                      className="h-8 w-8 rounded-lg border border-[var(--color-border-card)] bg-transparent cursor-pointer"
                      aria-label={`${label} accent override`}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="settings-muted font-semibold block">{label}</span>
                      {value && (
                        <button
                          type="button"
                          onClick={() => updateSetting(key, null)}
                          className="text-micro text-accent-blue hover:text-accent-blue/80"
                        >
                          Reset to preset
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </SettingsCard>
  )
}
