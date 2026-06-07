import { describe, it, expect } from 'vitest'
import { THEME_PROFILES } from '../theme'
import { blendOnSurface, contrastRatio } from '../contrast'

const ACCENT_KEYS = ['accentBlue', 'accentPurple', 'accentGreen', 'accentAmber'] as const
const TEXT_TOKENS = {
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

      for (const [tokenName, tokenColor] of Object.entries(TEXT_TOKENS)) {
        it(`text ${tokenName} meets WCAG AA on surface`, () => {
          const blended = blendOnSurface(tokenColor, profile.surface)
          const ratio = contrastRatio(blended, profile.surface)
          expect(ratio).toBeGreaterThanOrEqual(MIN_CONTRAST)
        })
      }
    })
  }
})
