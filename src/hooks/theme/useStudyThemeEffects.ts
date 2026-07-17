import { useEffect, useMemo, useState } from 'react'
import type { ThemeProfile } from '../../types/app'
import { applyThemeToDocument } from '../../lib/theme/applyThemeVars'
import { loadAppFonts } from '../../lib/theme/loadAppFonts'
import { resolveThemeProfile } from '../../lib/theme/theme'
import type { ParsedSettings } from '../../db/selectors/settingsFromRows'

const UI_FONT_STACKS: Record<string, string> = {
  Inter: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  Outfit: "'Outfit', 'Inter', sans-serif",
  System: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}

type ThemeEffectSettings = Pick<
  ParsedSettings,
  | 'theme'
  | 'themePreset'
  | 'lightThemePreset'
  | 'accentBlueOverride'
  | 'accentPurpleOverride'
  | 'accentGreenOverride'
  | 'accentAmberOverride'
  | 'cardOpacity'
  | 'backdropBlur'
  | 'backdropSaturate'
  | 'cardBorderOpacity'
  | 'ui_font'
  | 'developer_font'
>

export function useStudyThemeEffects(settings: ThemeEffectSettings): ThemeProfile {
  const [prefersDark, setPrefersDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    document.documentElement.style.setProperty('--font-monospace', `'${settings.developer_font}', monospace`)
  }, [settings.developer_font])

  useEffect(() => {
    const stack = UI_FONT_STACKS[settings.ui_font] ?? UI_FONT_STACKS.Inter
    document.documentElement.style.setProperty('--font-sans-geom', stack)
  }, [settings.ui_font])

  useEffect(() => {
    void loadAppFonts(settings.ui_font, settings.developer_font)
  }, [settings.ui_font, settings.developer_font])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const activeThemeVars = useMemo(
    () =>
      resolveThemeProfile(settings.theme, settings.themePreset, prefersDark, settings.lightThemePreset, {
        accentBlueOverride: settings.accentBlueOverride,
        accentPurpleOverride: settings.accentPurpleOverride,
        accentGreenOverride: settings.accentGreenOverride,
        accentAmberOverride: settings.accentAmberOverride,
      }),
    [
      settings.theme,
      settings.themePreset,
      settings.lightThemePreset,
      settings.accentBlueOverride,
      settings.accentPurpleOverride,
      settings.accentGreenOverride,
      settings.accentAmberOverride,
      prefersDark,
    ],
  )

  useEffect(() => {
    applyThemeToDocument(activeThemeVars, {
      cardOpacity: settings.cardOpacity,
      backdropBlur: settings.backdropBlur,
      backdropSaturate: settings.backdropSaturate,
      cardBorderOpacity: settings.cardBorderOpacity,
    })
  }, [
    activeThemeVars,
    settings.cardOpacity,
    settings.backdropBlur,
    settings.backdropSaturate,
    settings.cardBorderOpacity,
  ])

  return activeThemeVars
}
