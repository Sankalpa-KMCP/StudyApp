import { describe, it, expect } from 'vitest'
import { THEME_PROFILES } from '../theme'
import { blendHexOpacity, blendOnSurface, contrastRatio } from '../contrast'

const ACCENT_KEYS = ['accentBlue', 'accentPurple', 'accentGreen', 'accentAmber'] as const
const DARK_TEXT_TOKENS = {
  primary: '#ffffff',
  secondary: 'rgba(255, 255, 255, 0.65)',
  muted: 'rgba(255, 255, 255, 0.55)',
} as const
const MIN_CONTRAST = 4.5

describe('theme contrast', () => {
  for (const [themeName, profile] of Object.entries(THEME_PROFILES)) {
    describe(themeName, () => {
      for (const key of ACCENT_KEYS) {
        it(`${key} meets WCAG AA on surface`, () => {
          const ratio = contrastRatio(profile[key], profile.surface)
          expect(ratio).toBeGreaterThanOrEqual(MIN_CONTRAST)
        })
      }

      const textTokens = profile.isLight
        ? {
            primary: profile.textPrimary ?? '#1a1a2e',
            secondary: profile.textSecondary ?? 'rgba(26, 26, 46, 0.65)',
            muted: profile.textMuted ?? 'rgba(26, 26, 46, 0.55)',
          }
        : DARK_TEXT_TOKENS

      for (const [tokenName, tokenColor] of Object.entries(textTokens)) {
        it(`text ${tokenName} meets WCAG AA on surface`, () => {
          const blended = blendOnSurface(tokenColor, profile.surface)
          const ratio = contrastRatio(blended, profile.surface)
          expect(ratio).toBeGreaterThanOrEqual(MIN_CONTRAST)
        })

        it(`text ${tokenName} meets WCAG AA on surfaceCard`, () => {
          const blendedText = blendOnSurface(tokenColor, profile.surfaceCard)
          const ratio = contrastRatio(blendedText, profile.surfaceCard)
          expect(ratio).toBeGreaterThanOrEqual(MIN_CONTRAST)
        })
      }
    })
  }

  const LIGHT_PRESETS = ['paper-day', 'mist-slate', 'linen-warm', 'arctic-clean'] as const
  const LOW_CARD_OPACITY = 0.55

  describe('light glass opacity simulation', () => {
    for (const preset of LIGHT_PRESETS) {
      const profile = THEME_PROFILES[preset]
      it(`${preset} primary text meets WCAG AA on low-opacity glass card`, () => {
        const simulatedCard = blendHexOpacity(profile.surfaceCard, profile.surface, LOW_CARD_OPACITY)
        const blendedText = blendOnSurface(profile.textPrimary ?? '#1a1a2e', simulatedCard)
        const ratio = contrastRatio(blendedText, simulatedCard)
        expect(ratio).toBeGreaterThanOrEqual(MIN_CONTRAST)
      })
    }
  })
})
