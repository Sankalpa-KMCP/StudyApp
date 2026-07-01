import type { CSSProperties } from 'react'
import type { ThemeProfile } from '../../types/app'

export interface ThemeAppearanceSettings {
  cardOpacity: number
  backdropBlur: number
  backdropSaturate: number
  cardBorderOpacity: number
}

export function buildThemeInlineStyles(
  profile: ThemeProfile,
  settings: ThemeAppearanceSettings,
): CSSProperties {
  const isLight = profile.isLight ?? false
  const hoverRgb = profile.surfaceCardHoverRgb ?? profile.surfaceCardRgb

  return {
    '--color-surface': profile.surface,
    '--color-surface-card': profile.surfaceCard,
    '--color-surface-card-hover': profile.surfaceCardHover ?? profile.surfaceCard,
    '--color-text-primary': profile.textPrimary ?? '#ffffff',
    '--color-text-secondary': profile.textSecondary ?? 'rgba(255, 255, 255, 0.65)',
    '--color-text-muted': profile.textMuted ?? 'rgba(255, 255, 255, 0.55)',
    '--color-on-accent': profile.onAccent ?? '#080b11',
    '--color-nav-active-text': profile.navActiveText ?? profile.textPrimary ?? '#ffffff',
    '--color-accent-blue': profile.accentBlue,
    '--color-accent-purple': profile.accentPurple,
    '--color-accent-green': profile.accentGreen,
    '--color-accent-amber': profile.accentAmber,
    '--surface-card-rgb': profile.surfaceCardRgb,
    '--surface-card-hover-rgb': hoverRgb,
    '--surface-overlay': `rgba(${profile.surfaceCardRgb}, 0.95)`,
    '--overlay-backdrop': isLight ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.55)',
    '--body-base': profile.surface,
    '--body-ambient': profile.ambientGlow ?? 'none',
    '--scrollbar-thumb': profile.scrollbarThumb ?? (isLight ? 'rgba(0, 0, 0, 0.18)' : 'rgba(255, 255, 255, 0.12)'),
    '--scrollbar-thumb-hover': profile.scrollbarThumbHover ?? (isLight ? 'rgba(0, 0, 0, 0.28)' : 'rgba(255, 255, 255, 0.25)'),
    '--card-opacity': settings.cardOpacity,
    '--backdrop-blur': `${settings.backdropBlur}px`,
    '--backdrop-saturate': `${settings.backdropSaturate}%`,
    '--color-border-card': isLight
      ? `rgba(0, 0, 0, ${settings.cardBorderOpacity})`
      : `rgba(255, 255, 255, ${settings.cardBorderOpacity})`,
    background: profile.pageGradient,
  } as CSSProperties
}

export function applyThemeToDocument(
  profile: ThemeProfile,
  settings: ThemeAppearanceSettings,
): void {
  const isLight = profile.isLight ?? false
  const themeMode = isLight ? 'light' : 'dark'
  const root = document.documentElement

  root.dataset.themeMode = themeMode

  const vars = buildThemeInlineStyles(profile, settings)
  for (const [key, value] of Object.entries(vars)) {
    if (key.startsWith('--') && value !== undefined) {
      root.style.setProperty(key, String(value))
    }
  }

  document.body.style.backgroundColor = profile.surface
  document.body.style.backgroundImage = profile.ambientGlow ?? 'none'
}
