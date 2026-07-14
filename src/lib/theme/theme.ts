import type { CSSProperties } from 'react'
import type { ThemePresetMeta, ThemeProfile } from '../../types/app'
import { t, type TranslationKey } from '../../i18n'

export interface ThemeAccentOverrides {
  accentBlueOverride?: string | null
  accentPurpleOverride?: string | null
  accentGreenOverride?: string | null
  accentAmberOverride?: string | null
}

const DARK_TEXT = {
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.65)',
  textMuted: 'rgba(255, 255, 255, 0.55)',
  navActiveText: '#ffffff',
  onAccent: '#080b11',
  scrollbarThumb: 'rgba(255, 255, 255, 0.12)',
  scrollbarThumbHover: 'rgba(255, 255, 255, 0.25)',
} as const

const LIGHT_SCROLLBAR = {
  scrollbarThumb: 'rgba(0, 0, 0, 0.16)',
  scrollbarThumbHover: 'rgba(0, 0, 0, 0.26)',
} as const

function darkProfile(profile: Omit<ThemeProfile, keyof typeof DARK_TEXT> & Partial<ThemeProfile>): ThemeProfile {
  return { ...DARK_TEXT, ...profile }
}

function lightProfile(
  profile: Omit<ThemeProfile, 'isLight' | 'onAccent' | 'navActiveText'> & {
    textPrimary: string
    textSecondary: string
    textMuted: string
  },
): ThemeProfile {
  return {
    isLight: true,
    onAccent: '#ffffff',
    navActiveText: profile.textPrimary,
    ...LIGHT_SCROLLBAR,
    ...profile,
  }
}

export const THEME_PROFILES: Record<string, ThemeProfile> = {
  'midnight-slate': darkProfile({
    surface: '#0c1220',
    surfaceCard: '#1a2332',
    surfaceCardRgb: '26, 35, 50',
    surfaceCardHover: '#243044',
    surfaceCardHoverRgb: '36, 48, 68',
    pageGradient: 'radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 48%, #020617 100%)',
    ambientGlow: [
      'radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.14) 0px, transparent 50%)',
      'radial-gradient(at 100% 0%, rgba(99, 102, 241, 0.10) 0px, transparent 50%)',
      'radial-gradient(at 50% 100%, rgba(52, 211, 153, 0.05) 0px, transparent 50%)',
    ].join(', '),
    accentBlue: '#38bdf8',
    accentPurple: '#a78bfa',
    accentGreen: '#34d399',
    accentAmber: '#fbbf24',
  }),
  'midnight-oled': darkProfile({
    surface: '#000000',
    surfaceCard: '#0a0a0f',
    surfaceCardRgb: '10, 10, 15',
    surfaceCardHover: '#14141c',
    surfaceCardHoverRgb: '20, 20, 28',
    pageGradient: 'radial-gradient(circle at 50% 0%, #12121a 0%, #000000 70%)',
    ambientGlow: 'radial-gradient(at 50% 0%, rgba(99, 102, 241, 0.06) 0px, transparent 55%)',
    accentBlue: '#3b82f6',
    accentPurple: '#818cf8',
    accentGreen: '#10b981',
    accentAmber: '#f59e0b',
  }),
  'nordic-frost': darkProfile({
    surface: '#0d1219',
    surfaceCard: '#182230',
    surfaceCardRgb: '24, 34, 48',
    surfaceCardHover: '#223040',
    surfaceCardHoverRgb: '34, 48, 64',
    pageGradient: 'radial-gradient(circle at 50% 0%, #1a2a3a 0%, #0f141c 52%, #080c12 100%)',
    ambientGlow: [
      'radial-gradient(at 0% 0%, rgba(110, 196, 232, 0.16) 0px, transparent 50%)',
      'radial-gradient(at 100% 20%, rgba(212, 168, 207, 0.10) 0px, transparent 45%)',
    ].join(', '),
    accentBlue: '#6ec4e8',
    accentPurple: '#d4a8cf',
    accentGreen: '#8fcc7a',
    accentAmber: '#e8c070',
  }),
  'amber-retro': darkProfile({
    surface: '#0c0a09',
    surfaceCard: '#1c1917',
    surfaceCardRgb: '28, 25, 23',
    surfaceCardHover: '#262220',
    surfaceCardHoverRgb: '38, 34, 32',
    pageGradient: 'radial-gradient(circle at 50% 0%, #292017 0%, #0c0a09 55%, #050403 100%)',
    ambientGlow: [
      'radial-gradient(at 30% 0%, rgba(251, 191, 36, 0.12) 0px, transparent 50%)',
      'radial-gradient(at 80% 30%, rgba(251, 113, 133, 0.08) 0px, transparent 45%)',
    ].join(', '),
    textSecondary: 'rgba(255, 248, 240, 0.68)',
    textMuted: 'rgba(255, 248, 240, 0.58)',
    accentBlue: '#fb7185',
    accentPurple: '#e879f9',
    accentGreen: '#34d399',
    accentAmber: '#fbbf24',
  }),
  'nebula-purple': darkProfile({
    surface: '#0a0510',
    surfaceCard: '#1a0f28',
    surfaceCardRgb: '26, 15, 40',
    surfaceCardHover: '#241538',
    surfaceCardHoverRgb: '36, 21, 56',
    pageGradient: 'radial-gradient(circle at 50% 0%, #2a1545 0%, #0d0714 50%, #050208 100%)',
    ambientGlow: [
      'radial-gradient(at 20% 0%, rgba(168, 85, 247, 0.18) 0px, transparent 50%)',
      'radial-gradient(at 90% 10%, rgba(236, 72, 153, 0.12) 0px, transparent 45%)',
    ].join(', '),
    accentBlue: '#a855f7',
    accentPurple: '#ec4899',
    accentGreen: '#10b981',
    accentAmber: '#f59e0b',
  }),
  'forest-dusk': darkProfile({
    surface: '#061210',
    surfaceCard: '#0f1f1c',
    surfaceCardRgb: '15, 31, 28',
    surfaceCardHover: '#162a26',
    surfaceCardHoverRgb: '22, 42, 38',
    pageGradient: 'radial-gradient(circle at 50% 0%, #14302a 0%, #061210 55%, #020807 100%)',
    ambientGlow: [
      'radial-gradient(at 0% 0%, rgba(45, 212, 191, 0.14) 0px, transparent 50%)',
      'radial-gradient(at 100% 20%, rgba(16, 185, 129, 0.10) 0px, transparent 45%)',
    ].join(', '),
    accentBlue: '#2dd4bf',
    accentPurple: '#6ee7b7',
    accentGreen: '#10b981',
    accentAmber: '#fbbf24',
  }),
  'cosmos-ink': darkProfile({
    surface: '#050814',
    surfaceCard: '#0f1628',
    surfaceCardRgb: '15, 22, 40',
    surfaceCardHover: '#162038',
    surfaceCardHoverRgb: '22, 32, 56',
    pageGradient: 'radial-gradient(circle at 50% 0%, #1a2548 0%, #050814 55%, #02040a 100%)',
    ambientGlow: [
      'radial-gradient(at 10% 0%, rgba(34, 211, 238, 0.14) 0px, transparent 50%)',
      'radial-gradient(at 90% 15%, rgba(99, 102, 241, 0.12) 0px, transparent 45%)',
    ].join(', '),
    accentBlue: '#22d3ee',
    accentPurple: '#818cf8',
    accentGreen: '#34d399',
    accentAmber: '#fbbf24',
  }),
  'paper-day': lightProfile({
    surface: '#f4f2ed',
    surfaceCard: '#ffffff',
    surfaceCardRgb: '255, 255, 255',
    surfaceCardHover: '#f8f7f4',
    surfaceCardHoverRgb: '248, 247, 244',
    pageGradient: 'linear-gradient(180deg, #faf9f7 0%, #ebe8e3 100%)',
    ambientGlow: 'radial-gradient(at 50% 0%, rgba(0, 85, 179, 0.06) 0px, transparent 55%)',
    accentBlue: '#0055b3',
    accentPurple: '#6d28d9',
    accentGreen: '#047857',
    accentAmber: '#9a3412',
    textPrimary: '#1a1a2e',
    textSecondary: 'rgba(26, 26, 46, 0.72)',
    textMuted: 'rgba(26, 26, 46, 0.62)',
  }),
  'mist-slate': lightProfile({
    surface: '#e6ebf1',
    surfaceCard: '#f2f5f9',
    surfaceCardRgb: '242, 245, 249',
    surfaceCardHover: '#e8edf3',
    surfaceCardHoverRgb: '232, 237, 243',
    pageGradient: 'linear-gradient(180deg, #eef2f6 0%, #dde3ea 100%)',
    ambientGlow: 'radial-gradient(at 80% 0%, rgba(29, 78, 216, 0.07) 0px, transparent 50%)',
    accentBlue: '#1d4ed8',
    accentPurple: '#7e22ce',
    accentGreen: '#166534',
    accentAmber: '#9a3412',
    textPrimary: '#0f172a',
    textSecondary: 'rgba(15, 23, 42, 0.72)',
    textMuted: 'rgba(15, 23, 42, 0.62)',
  }),
  'linen-warm': lightProfile({
    surface: '#f3ebe0',
    surfaceCard: '#faf6f0',
    surfaceCardRgb: '250, 246, 240',
    surfaceCardHover: '#f0e8dc',
    surfaceCardHoverRgb: '240, 232, 220',
    pageGradient: 'linear-gradient(180deg, #faf6f0 0%, #e8dfd2 100%)',
    ambientGlow: 'radial-gradient(at 20% 0%, rgba(180, 83, 9, 0.08) 0px, transparent 50%)',
    accentBlue: '#1d4a8c',
    accentPurple: '#7c3aed',
    accentGreen: '#166534',
    accentAmber: '#92400e',
    textPrimary: '#2c1810',
    textSecondary: 'rgba(44, 24, 16, 0.72)',
    textMuted: 'rgba(44, 24, 16, 0.62)',
  }),
  'arctic-clean': lightProfile({
    surface: '#eef4fa',
    surfaceCard: '#f8fbff',
    surfaceCardRgb: '248, 251, 255',
    surfaceCardHover: '#e8f0f8',
    surfaceCardHoverRgb: '232, 240, 248',
    pageGradient: 'linear-gradient(180deg, #f8fbff 0%, #dce8f4 100%)',
    ambientGlow: 'radial-gradient(at 50% 0%, rgba(14, 165, 233, 0.08) 0px, transparent 55%)',
    accentBlue: '#0369a1',
    accentPurple: '#6d28d9',
    accentGreen: '#15803d',
    accentAmber: '#c2410c',
    textPrimary: '#0c1929',
    textSecondary: 'rgba(12, 25, 41, 0.72)',
    textMuted: 'rgba(12, 25, 41, 0.62)',
  }),
}

export const THEME_PRESET_META: ThemePresetMeta[] = [
  { id: 'midnight-slate', label: '', description: '', isLight: false, swatchOrder: 0 },
  { id: 'midnight-oled', label: '', description: '', isLight: false, swatchOrder: 1 },
  { id: 'nordic-frost', label: '', description: '', isLight: false, swatchOrder: 2 },
  { id: 'amber-retro', label: '', description: '', isLight: false, swatchOrder: 3 },
  { id: 'nebula-purple', label: '', description: '', isLight: false, swatchOrder: 4 },
  { id: 'forest-dusk', label: '', description: '', isLight: false, swatchOrder: 5 },
  { id: 'cosmos-ink', label: '', description: '', isLight: false, swatchOrder: 6 },
  { id: 'paper-day', label: '', description: '', isLight: true, swatchOrder: 7 },
  { id: 'mist-slate', label: '', description: '', isLight: true, swatchOrder: 8 },
  { id: 'linen-warm', label: '', description: '', isLight: true, swatchOrder: 9 },
  { id: 'arctic-clean', label: '', description: '', isLight: true, swatchOrder: 10 },
]

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

const THEME_PRESET_DESC_KEYS: Record<string, TranslationKey> = {
  'midnight-slate': 'themePresetMidnightSlateDesc',
  'midnight-oled': 'themePresetMidnightOledDesc',
  'nordic-frost': 'themePresetNordicFrostDesc',
  'amber-retro': 'themePresetAmberRetroDesc',
  'nebula-purple': 'themePresetNebulaPurpleDesc',
  'forest-dusk': 'themePresetForestDuskDesc',
  'cosmos-ink': 'themePresetCosmosInkDesc',
  'paper-day': 'themePresetPaperDayDesc',
  'mist-slate': 'themePresetMistSlateDesc',
  'linen-warm': 'themePresetLinenWarmDesc',
  'arctic-clean': 'themePresetArcticCleanDesc',
}

export function getThemePresetLabel(id: string): string {
  const key = THEME_PRESET_LABEL_KEYS[id]
  return key ? t(key) : id
}

export function getThemePresetDescription(id: string): string {
  const key = THEME_PRESET_DESC_KEYS[id]
  return key ? t(key) : ''
}

export function getThemePresetMeta(): ThemePresetMeta[] {
  return THEME_PRESET_META.map(preset => ({
    ...preset,
    label: getThemePresetLabel(preset.id),
    description: getThemePresetDescription(preset.id),
  }))
}

export const DARK_THEME_PRESETS = THEME_PRESET_META.filter(p => !p.isLight)
export const LIGHT_THEME_PRESETS = THEME_PRESET_META.filter(p => p.isLight)

export const DEFAULT_LIGHT_THEME_PRESET = 'paper-day'

export function resolveThemeId(
  theme: string,
  themePreset: string,
  prefersDark: boolean,
  lightThemePreset: string = DEFAULT_LIGHT_THEME_PRESET,
): string {
  if (theme === 'system') {
    return prefersDark ? themePreset : lightThemePreset
  }
  return theme
}

function applyAccentOverrides(profile: ThemeProfile, overrides?: ThemeAccentOverrides): ThemeProfile {
  if (!overrides) return profile
  return {
    ...profile,
    accentBlue: overrides.accentBlueOverride || profile.accentBlue,
    accentPurple: overrides.accentPurpleOverride || profile.accentPurple,
    accentGreen: overrides.accentGreenOverride || profile.accentGreen,
    accentAmber: overrides.accentAmberOverride || profile.accentAmber,
  }
}

export function resolveThemeProfile(
  theme: string,
  themePreset: string,
  prefersDark: boolean,
  lightThemePreset: string = DEFAULT_LIGHT_THEME_PRESET,
  overrides?: ThemeAccentOverrides,
): ThemeProfile {
  const id = resolveThemeId(theme, themePreset, prefersDark, lightThemePreset)
  const base = THEME_PROFILES[id] || THEME_PROFILES['midnight-oled']
  return applyAccentOverrides(base, overrides)
}

export function tooltipStyle(profile: ThemeProfile): CSSProperties {
  const isLight = profile.isLight ?? false
  const textColor = profile.textPrimary ?? (isLight ? '#1a1a2e' : '#e1ded7')
  const borderColor = isLight ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.1)'
  const shadowColor = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.4)'
  const insetHighlight = isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.08)'

  return {
    backgroundColor: isLight
      ? `rgba(${profile.surfaceCardRgb}, 0.95)`
      : 'rgba(8, 10, 15, 0.85)',
    backdropFilter: 'blur(16px)',
    border: `1px solid ${borderColor}`,
    borderRadius: '12px',
    boxShadow: `0 8px 32px ${shadowColor}, inset 0 1px 1px ${insetHighlight}`,
    color: textColor,
    outline: 'none',
  }
}

/** @deprecated Use tooltipStyle(profile) for theme-aware tooltips */
export const TOOLTIP_STYLE = tooltipStyle(THEME_PROFILES['midnight-slate'])

export { DAY_NAMES_SHORT, MONTH_NAMES } from '../shared/dateConstants'
