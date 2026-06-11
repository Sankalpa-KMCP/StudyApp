import { describe, it, expect } from 'vitest'
import { resolveThemeProfile, resolveThemeId } from '../theme'

describe('theme customization', () => {
  it('applies accent overrides on top of preset', () => {
    const profile = resolveThemeProfile('midnight-slate', 'midnight-slate', true, 'paper-day', {
      accentBlueOverride: '#ff0000',
      accentGreenOverride: null,
    })
    expect(profile.accentBlue).toBe('#ff0000')
    expect(profile.accentGreen).toBe('#34d399')
  })

  it('uses lightThemePreset when system prefers light', () => {
    expect(resolveThemeId('system', 'midnight-slate', false, 'mist-slate')).toBe('mist-slate')
    const profile = resolveThemeProfile('system', 'midnight-slate', false, 'paper-day')
    expect(profile.isLight).toBe(true)
    expect(profile.textPrimary).toBe('#1a1a2e')
  })

  it('resolves mist-slate light preset profile', () => {
    const profile = resolveThemeProfile('mist-slate', 'midnight-slate', true)
    expect(profile.isLight).toBe(true)
    expect(profile.surfaceCardRgb).toBe('242, 245, 249')
  })
})
