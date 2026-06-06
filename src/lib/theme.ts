import type { ThemeProfile } from '../types/app'

export const THEME_PROFILES: Record<string, ThemeProfile> = {
  'midnight-oled': {
    surface: '#0a0b10',
    surfaceCard: '#11131e',
    surfaceCardRgb: '17, 19, 30',
    accentBlue: '#3b82f6',
    accentPurple: '#6366f1',
    accentGreen: '#10b981',
    accentAmber: '#f59e0b',
  },
  'midnight-slate': {
    surface: '#0f172a',
    surfaceCard: '#1e293b',
    surfaceCardRgb: '30, 41, 59',
    accentBlue: '#38bdf8',
    accentPurple: '#a78bfa',
    accentGreen: '#34d399',
    accentAmber: '#fbbf24',
  },
  'nordic-frost': {
    surface: '#0f141c',
    surfaceCard: '#1a2332',
    surfaceCardRgb: '26, 35, 50',
    accentBlue: '#9fd4e8',
    accentPurple: '#c9a3c4',
    accentGreen: '#b8d4a3',
    accentAmber: '#f0d49a',
  },
  'amber-retro': {
    surface: '#0c0a09',
    surfaceCard: '#1c1917',
    surfaceCardRgb: '28, 25, 23',
    accentBlue: '#fb7185',
    accentPurple: '#e879f9',
    accentGreen: '#34d399',
    accentAmber: '#fbbf24',
  },
  'nebula-purple': {
    surface: '#0d0714',
    surfaceCard: '#1c102b',
    surfaceCardRgb: '28, 16, 43',
    accentBlue: '#a855f7',
    accentPurple: '#ec4899',
    accentGreen: '#10b981',
    accentAmber: '#f59e0b',
  },
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
