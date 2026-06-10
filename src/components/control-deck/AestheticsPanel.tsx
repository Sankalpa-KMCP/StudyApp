import type { SettingsKey, SettingsValue } from '../../db/types'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { RangeSetting } from '../shared/settings/RangeSetting'

const DARK_PRESETS = [
  { value: 'midnight-slate', label: 'Midnight Slate (Default)' },
  { value: 'midnight-oled', label: 'Midnight OLED' },
  { value: 'nordic-frost', label: 'Nordic Frost' },
  { value: 'amber-retro', label: 'Amber Retro' },
  { value: 'nebula-purple', label: 'Nebula Purple' },
] as const

const LIGHT_PRESETS = [
  { value: 'paper-day', label: 'Paper Day' },
  { value: 'mist-slate', label: 'Mist Slate' },
] as const

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
  const isSystem = theme === 'system'

  const handleThemeModeChange = (value: string) => {
    if (value === 'system') {
      updateSetting('theme', 'system')
    } else {
      updateSetting('theme', value)
      updateSetting('themePreset', value)
    }
  }

  const selectValue = isSystem ? 'system' : themePreset

  return (
    <SettingsCard title="Aesthetics & Translucency">
      <div className="space-y-6">
        <div>
          <span className="text-xs font-semibold text-white/80 block mb-2">Theme mode</span>
          <select
            value={selectValue}
            onChange={e => handleThemeModeChange(e.target.value)}
            className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white outline-none cursor-pointer hover:bg-white/10 transition-colors font-semibold"
          >
            <option value="system" className="bg-[#11131e] text-white">Match system</option>
            {DARK_PRESETS.map(p => (
              <option key={p.value} value={p.value} className="bg-[#11131e] text-white">{p.label}</option>
            ))}
            {LIGHT_PRESETS.map(p => (
              <option key={p.value} value={p.value} className="bg-[#11131e] text-white">{p.label}</option>
            ))}
          </select>
        </div>

        {isSystem && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-semibold text-white/80 block mb-2">Dark preset</span>
              <select
                value={themePreset}
                onChange={e => updateSetting('themePreset', e.target.value)}
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white outline-none cursor-pointer hover:bg-white/10 transition-colors font-semibold"
              >
                {DARK_PRESETS.map(p => (
                  <option key={p.value} value={p.value} className="bg-[#11131e] text-white">{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-xs font-semibold text-white/80 block mb-2">Light preset</span>
              <select
                value={lightThemePreset}
                onChange={e => updateSetting('lightThemePreset', e.target.value)}
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white outline-none cursor-pointer hover:bg-white/10 transition-colors font-semibold"
              >
                {LIGHT_PRESETS.map(p => (
                  <option key={p.value} value={p.value} className="bg-[#11131e] text-white">{p.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <span className="text-xs font-semibold text-white/80 block mb-2">UI font</span>
          <select
            value={uiFont}
            onChange={e => updateSetting('ui_font', e.target.value)}
            className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white outline-none cursor-pointer hover:bg-white/10 transition-colors font-semibold"
          >
            {UI_FONT_OPTIONS.map(f => (
              <option key={f} value={f} className="bg-[#11131e] text-white">{f}</option>
            ))}
          </select>
        </div>

        <div>
          <span className="text-xs font-semibold text-white/80 block mb-2">UI density</span>
          <select
            value={uiDensity}
            onChange={e => updateSetting('uiDensity', e.target.value)}
            className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white outline-none cursor-pointer hover:bg-white/10 transition-colors font-semibold"
          >
            <option value="comfortable" className="bg-[#11131e] text-white">Comfortable</option>
            <option value="compact" className="bg-[#11131e] text-white">Compact</option>
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
          <span className="text-xs font-semibold text-white/80 block mb-3">Accent overrides</span>
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
                  className="h-8 w-8 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                  aria-label={`${label} accent override`}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-micro font-semibold text-white/60 block">{label}</span>
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
