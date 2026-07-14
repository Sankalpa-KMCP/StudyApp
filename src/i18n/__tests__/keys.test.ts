import { describe, it, expect } from 'vitest'
import en from '../locales/en.json'
import { t, type TranslationKey } from '../index'

describe('i18n keys', () => {
  it('resolves every TranslationKey to a non-empty string', () => {
    const keys = Object.keys(en) as TranslationKey[]
    expect(keys.length).toBeGreaterThan(0)

    for (const key of keys) {
      const value = t(key)
      expect(value, `key "${key}" should resolve to non-empty string`).toBeTruthy()
      expect(typeof value).toBe('string')
      expect(value.trim().length).toBeGreaterThan(0)
    }
  })

  it('interpolates common parameterized keys', () => {
    expect(t('archivedTasksMany', { count: 3 })).toContain('3')
    expect(t('errorTabCrashed', { label: 'Focus' })).toContain('Focus')
  })
})
