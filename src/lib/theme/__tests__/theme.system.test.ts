import { describe, it, expect } from 'vitest'
import { resolveThemeId, resolveThemeProfile } from '../theme'

describe('system theme resolution', () => {
  it('uses light preset when system theme and prefers light', () => {
    expect(resolveThemeId('system', 'midnight-slate', false)).toBe('paper-day')
    expect(resolveThemeId('system', 'midnight-slate', false, 'mist-slate')).toBe('mist-slate')
  })

  it('uses stored preset when system theme and prefers dark', () => {
    expect(resolveThemeId('system', 'amber-retro', true)).toBe('amber-retro')
  })

  it('returns a theme profile for system mode', () => {
    const profile = resolveThemeProfile('system', 'midnight-oled', true)
    expect(profile.surface).toBeTruthy()
    expect(profile.accentBlue).toBeTruthy()
  })
})
