import { describe, it, expect } from 'vitest'
import { THEME_PROFILES } from '../theme'
import { contrastRatio } from '../contrast'

const ACCENT_KEYS = ['accentBlue', 'accentPurple', 'accentGreen', 'accentAmber'] as const
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
    })
  }
})
