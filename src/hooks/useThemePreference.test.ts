import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  THEME_COLORS,
  THEME_STORAGE_KEY,
  isThemeMode,
  readStoredThemeMode,
  useThemePreference,
} from './useThemePreference'

describe('theme preference helpers', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.dataset.theme = 'monochrome'
    let themeColorMeta = document.querySelector('meta[name="theme-color"]')
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta')
      themeColorMeta.setAttribute('name', 'theme-color')
      document.head.append(themeColorMeta)
    }
    themeColorMeta.setAttribute('content', '#111111')
  })

  it('accepts every valid theme id and rejects invalid values', () => {
    for (const theme of Object.keys(THEME_COLORS)) {
      expect(isThemeMode(theme)).toBe(true)
    }
    expect(isThemeMode(null)).toBe(false)
    expect(isThemeMode('unknown-theme')).toBe(false)
  })

  it('reads stored themes and falls back to monochrome when missing or invalid', () => {
    expect(readStoredThemeMode()).toBe('monochrome')

    localStorage.setItem(THEME_STORAGE_KEY, 'aurora')
    expect(readStoredThemeMode()).toBe('aurora')

    localStorage.setItem(THEME_STORAGE_KEY, 'not-a-theme')
    expect(readStoredThemeMode()).toBe('monochrome')
  })
})

describe('useThemePreference', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.dataset.theme = 'monochrome'
    let themeColorMeta = document.querySelector('meta[name="theme-color"]')
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta')
      themeColorMeta.setAttribute('name', 'theme-color')
      document.head.append(themeColorMeta)
    }
    themeColorMeta.setAttribute('content', '#111111')
  })

  it('initializes from storage, updates DOM metadata, and persists user changes', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'blueprint')
    const onPreferenceError = vi.fn()
    const clearPreferenceNotice = vi.fn()

    const { result } = renderHook(() => useThemePreference({ onPreferenceError, clearPreferenceNotice }))

    expect(result.current.theme).toBe('blueprint')
    expect(document.documentElement.dataset.theme).toBe('blueprint')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', THEME_COLORS.blueprint)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('blueprint')

    act(() => {
      result.current.setTheme('moss')
    })

    expect(clearPreferenceNotice).toHaveBeenCalledTimes(1)
    expect(result.current.theme).toBe('moss')
    expect(document.documentElement.dataset.theme).toBe('moss')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', THEME_COLORS.moss)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('moss')
    expect(onPreferenceError).not.toHaveBeenCalled()
  })

  it('reports a friendly error only for failed user-initiated persistence', () => {
    const onPreferenceError = vi.fn()
    const clearPreferenceNotice = vi.fn()
    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === THEME_STORAGE_KEY) throw new Error('quota exceeded')
      return originalSetItem.call(this, key, value)
    })

    const { result } = renderHook(() => useThemePreference({ onPreferenceError, clearPreferenceNotice }))

    expect(onPreferenceError).not.toHaveBeenCalled()

    act(() => {
      result.current.setTheme('dark')
    })

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(onPreferenceError).toHaveBeenCalledWith('Theme preference could not be saved.')
    expect(clearPreferenceNotice).toHaveBeenCalledTimes(1)
  })
})
