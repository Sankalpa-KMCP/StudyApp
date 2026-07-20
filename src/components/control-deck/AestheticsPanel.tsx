import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useConfirm } from '../../context/useConfirm'
import { APPEARANCE_ADVANCED_KEYS } from '../../lib/settings/settingsSections'
import { useTranslation } from '../../i18n/useTranslation'
import { SUPPORTED_LOCALES } from '../../i18n/locales'
import { useSettingsPanel } from '../../context/settingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { RangeSetting } from '../shared/settings/RangeSetting'
import { ThemeSwatchPicker } from './ThemeSwatchPicker'
import { Button } from '../shared/Button'

const UI_FONT_OPTIONS = ['Inter', 'Outfit', 'System'] as const

const ACCENT_OVERRIDE_DEFAULTS = {
  accentBlueOverride: '#007aff',
  accentPurpleOverride: '#af52de',
  accentGreenOverride: '#34c759',
  accentAmberOverride: '#ff9500',
} as const

export function AestheticsPanel() {
  const { t } = useTranslation()
  const {
    theme,
    themePreset,
    lightThemePreset,
    ui_font: uiFont,
    locale,
    uiDensity,
    cardOpacity,
    backdropBlur,
    backdropSaturate,
    cardBorderOpacity,
    reduceVisualEffects,
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
      title: t('aestheticsResetGlassConfirmTitle'),
      message: t('aestheticsResetGlassConfirmMessage'),
      confirmLabel: t('aestheticsResetGlassConfirmLabel'),
    })
    if (!ok) return
    void resetKeys(APPEARANCE_ADVANCED_KEYS, t('aestheticsAppearanceAdvancedRestored'))
  }

  return (
    <SettingsCard id="settings-aesthetics" title={t('aestheticsPanelTitle')}>
      <div className="space-y-6">
        <ThemeSwatchPicker
          theme={theme}
          themePreset={themePreset}
          lightThemePreset={lightThemePreset}
          updateSetting={updateSetting}
        />

        <div>
          <label htmlFor="aesthetics-ui-font" className="settings-label block mb-2">{t('aestheticsUiFont')}</label>
          <select
            id="aesthetics-ui-font"
            value={uiFont}
            onChange={e => updateSetting('ui_font', e.target.value)}
            className="settings-select focus-ring"
          >
            {UI_FONT_OPTIONS.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="aesthetics-locale" className="settings-label block mb-2">{t('aestheticsLocale')}</label>
          <select
            id="aesthetics-locale"
            value={locale}
            onChange={e => updateSetting('locale', e.target.value)}
            className="settings-select focus-ring"
          >
            {SUPPORTED_LOCALES.map(({ code, labelKey }) => (
              <option key={code} value={code}>{t(labelKey)}</option>
            ))}
          </select>
          <p className="settings-muted mt-2">{t('aestheticsLocaleHelper')}</p>
        </div>

        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="settings-label">{t('aestheticsReduceVisualEffects')}</span>
          <input
            type="checkbox"
            checked={reduceVisualEffects}
            onChange={e => updateSetting('reduceVisualEffects', e.target.checked)}
            className="h-4 w-4 rounded border-card accent-accent-blue focus-ring"
          />
        </label>
        <p className="settings-muted -mt-4 mb-2">{t('aestheticsReduceVisualEffectsHelper')}</p>

        <div>
          <label htmlFor="aesthetics-ui-density" className="settings-label block mb-2">{t('aestheticsUiDensity')}</label>
          <select
            id="aesthetics-ui-density"
            value={uiDensity}
            onChange={e => updateSetting('uiDensity', e.target.value)}
            className="settings-select focus-ring"
          >
            <option value="comfortable">{t('aestheticsUiDensityComfortable')}</option>
            <option value="compact">{t('aestheticsUiDensityCompact')}</option>
          </select>
        </div>

        <div className="border-t border-card pt-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <button
              type="button"
              onClick={() => setAdvancedOpen(o => !o)}
              className="flex items-center gap-2 settings-label focus-ring rounded-lg px-1"
              aria-expanded={advancedOpen}
            >
              <ChevronDown aria-hidden className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              {t('aestheticsAdvancedGlassAccents')}
            </button>
            <Button type="button" variant="ghost" size="sm" onClick={() => void handleResetAdvanced()} className="!px-0">
              {t('aestheticsReset')}
            </Button>
          </div>
          {advancedOpen && (
          <div className="space-y-4">
            <RangeSetting
              label={t('aestheticsCardBackdropOpacity')}
              value={Math.round(cardOpacity * 100)}
              min={20}
              max={90}
              step={5}
              unit="%"
              onChange={v => updateSetting('cardOpacity', v / 100)}
            />
            <RangeSetting
              label={t('aestheticsFrostingBlurSize')}
              value={backdropBlur}
              min={4}
              max={24}
              step={1}
              unit="px"
              onChange={v => updateSetting('backdropBlur', v)}
            />
            <RangeSetting
              label={t('aestheticsGlassSaturation')}
              value={backdropSaturate}
              min={100}
              max={200}
              step={5}
              unit="%"
              onChange={v => updateSetting('backdropSaturate', v)}
            />
            <RangeSetting
              label={t('aestheticsCardBorderOpacity')}
              value={Math.round(cardBorderOpacity * 100)}
              min={4}
              max={16}
              step={1}
              unit="%"
              onChange={v => updateSetting('cardBorderOpacity', v / 100)}
            />

            <div>
              <span className="settings-label block mb-3">{t('aestheticsAccentOverrides')}</span>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['accentBlueOverride', t('aestheticsAccentBlue'), accentBlueOverride],
                  ['accentPurpleOverride', t('aestheticsAccentPurple'), accentPurpleOverride],
                  ['accentGreenOverride', t('aestheticsAccentGreen'), accentGreenOverride],
                  ['accentAmberOverride', t('aestheticsAccentAmber'), accentAmberOverride],
                ] as const).map(([key, label, value]) => {
                  const inputId = `aesthetics-${key}`
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <label htmlFor={inputId} className="sr-only">{label}</label>
                      <input
                        id={inputId}
                        type="color"
                        value={value || ACCENT_OVERRIDE_DEFAULTS[key]}
                        onChange={e => updateSetting(key, e.target.value)}
                        className="h-8 w-8 rounded-lg border border-card bg-transparent cursor-pointer focus-ring"
                        aria-label={t('aestheticsAccentOverrideAria', { color: label })}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="settings-muted font-semibold block">{label}</span>
                        {value && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => updateSetting(key, null)}
                            className="!h-auto !px-0 !py-0 text-micro"
                          >
                            {t('aestheticsResetToPreset')}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </SettingsCard>
  )
}
