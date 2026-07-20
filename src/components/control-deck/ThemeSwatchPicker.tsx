import { THEME_PROFILES, DARK_THEME_PRESETS, LIGHT_THEME_PRESETS } from '../../lib/theme/theme'
import type { SettingsKey, SettingsValue } from '../../db/types'
import { useTranslation } from '../../i18n/useTranslation'
import type { TranslationKey } from '../../i18n'

interface ThemeSwatchPickerProps {
  theme: string
  themePreset: string
  lightThemePreset: string
  updateSetting: (key: SettingsKey, val: SettingsValue) => void
}

const THEME_PRESET_LABEL_KEYS: Record<string, TranslationKey> = {
  'midnight-slate': 'themePresetMidnightSlate',
  'midnight-oled': 'themePresetMidnightOled',
  'nordic-frost': 'themePresetNordicFrost',
  'amber-retro': 'themePresetAmberRetro',
  'nebula-purple': 'themePresetNebulaPurple',
  'forest-dusk': 'themePresetForestDusk',
  'cosmos-ink': 'themePresetCosmosInk',
  'paper-day': 'themePresetPaperDay',
  'mist-slate': 'themePresetMistSlate',
  'linen-warm': 'themePresetLinenWarm',
  'arctic-clean': 'themePresetArcticClean',
}

function SwatchButton({
  id,
  label,
  selected,
  onClick,
}: {
  id: string
  label: string
  selected: boolean
  onClick: () => void
}) {
  const profile = THEME_PROFILES[id]
  if (!profile) return null

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      className={`group relative flex flex-col gap-1.5 rounded-xl p-2 text-left transition-all focus-ring ${
        selected
          ? 'ring-2 ring-accent-blue ring-offset-2 ring-offset-transparent'
          : 'ring-1 ring-transparent hover:ring-accent-blue/20'
      }`}
    >
      <div
        className="h-10 w-full rounded-lg border border-card overflow-hidden"
        style={{ background: profile.pageGradient }}
      >
        <div className="flex h-full items-end gap-0.5 p-1.5">
          {[profile.accentBlue, profile.accentPurple, profile.accentGreen, profile.accentAmber].map(color => (
            <span
              key={color}
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
      <span className="settings-muted truncate px-0.5">{label}</span>
    </button>
  )
}

export function ThemeSwatchPicker({
  theme,
  themePreset,
  lightThemePreset,
  updateSetting,
}: ThemeSwatchPickerProps) {
  const { t } = useTranslation()
  const isSystem = theme === 'system'
  const activePreset = isSystem ? null : theme

  const presetLabel = (id: string) => {
    const key = THEME_PRESET_LABEL_KEYS[id]
    return key ? t(key) : id
  }

  const selectPreset = (id: string, isLight: boolean) => {
    if (isLight) {
      updateSetting('theme', id)
      updateSetting('themePreset', id)
      updateSetting('lightThemePreset', id)
    } else {
      updateSetting('theme', id)
      updateSetting('themePreset', id)
    }
  }

  const selectSystem = () => {
    updateSetting('theme', 'system')
  }

  return (
    <div className="space-y-4">
      <div>
        <span className="settings-label block mb-2">{t('themeMode')}</span>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={selectSystem}
            aria-pressed={isSystem}
            className={`rounded-xl p-2 text-left transition-all focus-ring ${
              isSystem
                ? 'ring-2 ring-accent-blue ring-offset-2 ring-offset-transparent'
                : 'ring-1 ring-transparent hover:ring-accent-blue/20'
            }`}
          >
            <div className="h-10 w-full rounded-lg border border-card overflow-hidden flex">
              <div className="flex-1" style={{ background: THEME_PROFILES[themePreset]?.pageGradient }} />
              <div className="flex-1" style={{ background: THEME_PROFILES[lightThemePreset]?.pageGradient }} />
            </div>
            <span className="settings-muted block mt-1.5 px-0.5">{t('themeMatchSystem')}</span>
          </button>
        </div>
      </div>

      <div>
        <span className="settings-label block mb-2">{t('themeDarkPresets')}</span>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {DARK_THEME_PRESETS.map(p => (
            <SwatchButton
              key={p.id}
              id={p.id}
              label={presetLabel(p.id)}
              selected={!isSystem && activePreset === p.id}
              onClick={() => selectPreset(p.id, false)}
            />
          ))}
        </div>
      </div>

      <div>
        <span className="settings-label block mb-2">{t('themeLightPresets')}</span>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {LIGHT_THEME_PRESETS.map(p => (
            <SwatchButton
              key={p.id}
              id={p.id}
              label={presetLabel(p.id)}
              selected={!isSystem && activePreset === p.id}
              onClick={() => selectPreset(p.id, true)}
            />
          ))}
        </div>
      </div>

      {isSystem && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-card">
          <div>
            <span className="settings-label block mb-2">{t('themeSystemDarkPreset')}</span>
            <div className="grid grid-cols-3 gap-2">
              {DARK_THEME_PRESETS.map(p => (
                <SwatchButton
                  key={p.id}
                  id={p.id}
                  label={presetLabel(p.id)}
                  selected={themePreset === p.id}
                  onClick={() => updateSetting('themePreset', p.id)}
                />
              ))}
            </div>
          </div>
          <div>
            <span className="settings-label block mb-2">{t('themeSystemLightPreset')}</span>
            <div className="grid grid-cols-3 gap-2">
              {LIGHT_THEME_PRESETS.map(p => (
                <SwatchButton
                  key={p.id}
                  id={p.id}
                  label={presetLabel(p.id)}
                  selected={lightThemePreset === p.id}
                  onClick={() => updateSetting('lightThemePreset', p.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
