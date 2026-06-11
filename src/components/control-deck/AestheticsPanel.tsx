import type { SettingsKey, SettingsValue } from '../../db/types'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { RangeSetting } from '../shared/settings/RangeSetting'
import { ThemeSwatchPicker } from './ThemeSwatchPicker'

const UI_FONT_OPTIONS = ['Inter', 'Outfit', 'System'] as const

interface AestheticsPanelProps {
  theme: string
  themePreset: string
  lightThemePreset: string
  uiFont: string
  uiDensity: 'comfortable' | 'compact'
  cardOpacity: number
  backdropBlur: number
  backdropSaturate: number
  cardBorderOpacity: number
  accentBlueOverride: string | null
  accentPurpleOverride: string | null
  accentGreenOverride: string | null
  accentAmberOverride: string | null
  updateSetting: (key: SettingsKey, val: SettingsValue) => void
}

export function AestheticsPanel({
  theme,
  themePreset,
  lightThemePreset,
  uiFont,
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
}: AestheticsPanelProps) {
  return (
    <SettingsCard title="Aesthetics & Translucency">
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
    </SettingsCard>
  )
}
