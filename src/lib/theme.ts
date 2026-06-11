import type { ThemeProfile } from '../types/app'

export interface ThemeAccentOverrides {
  accentBlueOverride?: string | null
  accentPurpleOverride?: string | null
  accentGreenOverride?: string | null
  accentAmberOverride?: string | null
}

export const THEME_PROFILES: Record<string, ThemeProfile> = {
  'midnight-oled': {
    surface: '#0a0b10',
    surfaceCard: '#11131e',
    surfaceCardRgb: '17, 19, 30',
    pageGradient: 'radial-gradient(circle at 50% 0%, #1c1533 0%, #0d0a1b 45%, #05040a 100%)',
    accentBlue: '#3b82f6',
    accentPurple: '#818cf8',
    accentGreen: '#10b981',
    accentAmber: '#f59e0b',
    isLight: false,
  },
  'midnight-slate': {
    surface: '#0f172a',
    surfaceCard: '#1e293b',
    surfaceCardRgb: '30, 41, 59',
    pageGradient: 'radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 50%, #020617 100%)',
    accentBlue: '#38bdf8',
    accentPurple: '#a78bfa',
    accentGreen: '#34d399',
    accentAmber: '#fbbf24',
    isLight: false,
  },
  'nordic-frost': {
    surface: '#0f141c',
    surfaceCard: '#1a2332',
    surfaceCardRgb: '26, 35, 50',
    pageGradient: 'radial-gradient(circle at 50% 0%, #1a2a3a 0%, #0f141c 50%, #080c12 100%)',
    accentBlue: '#6ec4e8',
    accentPurple: '#d4a8cf',
    accentGreen: '#8fcc7a',
    accentAmber: '#e8c070',
    isLight: false,
  },
  'amber-retro': {
    surface: '#0c0a09',
    surfaceCard: '#1c1917',
    surfaceCardRgb: '28, 25, 23',
    pageGradient: 'radial-gradient(circle at 50% 0%, #292017 0%, #0c0a09 55%, #050403 100%)',
    accentBlue: '#fb7185',
    accentPurple: '#e879f9',
    accentGreen: '#34d399',
    accentAmber: '#fbbf24',
    isLight: false,
  },
  'nebula-purple': {
    surface: '#0d0714',
    surfaceCard: '#1c102b',
    surfaceCardRgb: '28, 16, 43',
    pageGradient: 'radial-gradient(circle at 50% 0%, #2a1545 0%, #0d0714 50%, #050208 100%)',
    accentBlue: '#a855f7',
    accentPurple: '#ec4899',
    accentGreen: '#10b981',
    accentAmber: '#f59e0b',
    isLight: false,
  },
  'paper-day': {
    surface: '#f5f3ef',
    surfaceCard: '#ffffff',
    surfaceCardRgb: '255, 255, 255',
    pageGradient: 'linear-gradient(180deg, #faf9f7 0%, #ebe8e3 100%)',
    accentBlue: '#0055b3',
    accentPurple: '#6d28d9',
    accentGreen: '#047857',
    accentAmber: '#b45309',
    isLight: true,
    textPrimary: '#1a1a2e',
    textSecondary: 'rgba(26, 26, 46, 0.72)',
    textMuted: 'rgba(26, 26, 46, 0.62)',
    onAccent: '#ffffff',
  },
  'mist-slate': {
    surface: '#e8ecf1',
    surfaceCard: '#f4f6f9',
    surfaceCardRgb: '244, 246, 249',
    pageGradient: 'linear-gradient(180deg, #eef2f6 0%, #dde3ea 100%)',
    accentBlue: '#1d4ed8',
    accentPurple: '#7e22ce',
    accentGreen: '#166534',
    accentAmber: '#9a3412',
    isLight: true,
    textPrimary: '#0f172a',
    textSecondary: 'rgba(15, 23, 42, 0.72)',
    textMuted: 'rgba(15, 23, 42, 0.62)',
    onAccent: '#ffffff',
  },
}

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

export const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(8, 10, 15, 0.85)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.08)',
  color: '#e1ded7',
  outline: 'none',
}

export { DAY_NAMES_SHORT, MONTH_NAMES } from './dateConstants'
