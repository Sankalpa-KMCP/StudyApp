import { describe, it, expect } from 'vitest'
import { clampSetting, validateSetting } from '../settingsValidation'

describe('settingsValidation', () => {
  it('clamps dailyGoalMinutes to step 30', () => {
    expect(clampSetting('dailyGoalMinutes', 45)).toBe(60)
    expect(clampSetting('dailyGoalMinutes', 1000)).toBe(960)
    expect(clampSetting('dailyGoalMinutes', 10)).toBe(30)
  })

  it('clamps study block duration to 5-minute steps', () => {
    expect(clampSetting('studyBlockDurationMinutes', 27)).toBe(25)
    expect(clampSetting('studyBlockDurationMinutes', 28)).toBe(30)
    expect(clampSetting('studyBlockDurationMinutes', 200)).toBe(120)
  })

  it('clamps initialEasinessFactor to 0.1 steps', () => {
    expect(clampSetting('initialEasinessFactor', 2.54)).toBe(2.5)
    expect(clampSetting('initialEasinessFactor', 2.56)).toBe(2.6)
  })

  it('accepts boolean settings', () => {
    expect(validateSetting('soundEnabled', true)).toEqual({ ok: true, value: true })
    expect(validateSetting('soundEnabled', 'yes')).toEqual({ ok: false, reason: 'soundEnabled must be a boolean' })
    expect(validateSetting('ambientSoundEnabled', false)).toEqual({ ok: true, value: false })
  })

  it('validates ambientSoundPreset enum', () => {
    expect(validateSetting('ambientSoundPreset', 'rain')).toEqual({ ok: true, value: 'rain' })
    expect(validateSetting('ambientSoundPreset', 'white-noise')).toEqual({ ok: true, value: 'white-noise' })
    expect(validateSetting('ambientSoundPreset', 'cafe')).toEqual({ ok: true, value: 'cafe' })
    expect(validateSetting('ambientSoundPreset', 'brown-noise')).toEqual({ ok: true, value: 'brown-noise' })
    expect(validateSetting('ambientSoundPreset', 'ocean').ok).toBe(false)
  })

  it('accepts null accent overrides', () => {
    expect(validateSetting('accentBlueOverride', null)).toEqual({ ok: true, value: null })
  })

  it('validates hex accent overrides', () => {
    expect(validateSetting('accentBlueOverride', '#3b82f6')).toEqual({ ok: true, value: '#3b82f6' })
    expect(validateSetting('accentBlueOverride', 'blue').ok).toBe(false)
  })

  it('validates uiDensity enum', () => {
    expect(validateSetting('uiDensity', 'comfortable')).toEqual({ ok: true, value: 'comfortable' })
    expect(validateSetting('uiDensity', 'spacious').ok).toBe(false)
  })

  it('normalizes noteTagColors JSON', () => {
    const colors = '["#06b6d4","#3b82f6"]'
    expect(validateSetting('noteTagColors', colors)).toEqual({ ok: true, value: colors })
    expect(validateSetting('noteTagColors', 'not-json').ok).toBe(false)
  })
})
