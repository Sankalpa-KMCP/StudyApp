import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_THEME_MODE,
  THEME_COLORS,
  THEME_CONFIGS,
  THEME_MODES,
  THEME_STORAGE_KEY,
  getThemeConfig,
  isThemeMode,
  readStoredThemeMode,
  useThemePreference,
} from './useThemePreference'

describe('theme preference and registry helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    document.documentElement.dataset.theme = DEFAULT_THEME_MODE
    let themeColorMeta = document.querySelector('meta[name="theme-color"]')
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta')
      themeColorMeta.setAttribute('name', 'theme-color')
      document.head.append(themeColorMeta)
    }
    themeColorMeta.setAttribute('content', THEME_COLORS[DEFAULT_THEME_MODE])
  })

  it('registers all 16 theme modes with valid hex theme-colors and non-empty metadata', () => {
    expect(THEME_MODES).toHaveLength(16)
    expect(THEME_CONFIGS).toHaveLength(16)
    for (const mode of THEME_MODES) {
      expect(isThemeMode(mode)).toBe(true)
      expect(THEME_COLORS[mode]).toMatch(/^#[0-9a-f]{6}$/i)
      const config = getThemeConfig(mode)
      expect(config.id).toBe(mode)
      expect(config.label.length).toBeGreaterThan(0)
      expect(config.description.length).toBeGreaterThan(0)
      expect(config.themeColor).toBe(THEME_COLORS[mode])
      expect(['light', 'dark']).toContain(config.colorScheme)
    }
  })

  it('rejects invalid values', () => {
    expect(isThemeMode(null)).toBe(false)
    expect(isThemeMode(undefined)).toBe(false)
    expect(isThemeMode('')).toBe(false)
    expect(isThemeMode('unknown-theme')).toBe(false)
    expect(isThemeMode(123)).toBe(false)
  })

  it('returns fallback config for unrecognized mode in getThemeConfig', () => {
    // @ts-expect-error test unknown theme fallback
    expect(getThemeConfig('nonexistent')).toEqual(THEME_CONFIGS[0])
  })

  it('reads stored themes including legacy and new IDs, and falls back to monochrome when missing or invalid', () => {
    expect(readStoredThemeMode()).toBe('monochrome')

    // Legacy theme IDs
    for (const legacyTheme of ['monochrome', 'light', 'blueprint', 'moss', 'ember', 'dark', 'aurora'] as const) {
      localStorage.setItem(THEME_STORAGE_KEY, legacyTheme)
      expect(readStoredThemeMode()).toBe(legacyTheme)
    }

    // New theme IDs
    for (const newTheme of ['nordic', 'espresso', 'sage', 'obsidian', 'rose-quartz', 'ocean-glass', 'sandstone', 'plum-noir', 'forest-dark'] as const) {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme)
      expect(readStoredThemeMode()).toBe(newTheme)
    }

    localStorage.setItem(THEME_STORAGE_KEY, 'not-a-theme')
    expect(readStoredThemeMode()).toBe('monochrome')
  })

  it('falls back to monochrome when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === THEME_STORAGE_KEY) throw new Error('SecurityError: storage access denied')
      return null
    })
    expect(readStoredThemeMode()).toBe('monochrome')
  })
})

describe('useThemePreference', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    document.documentElement.dataset.theme = DEFAULT_THEME_MODE
    let themeColorMeta = document.querySelector('meta[name="theme-color"]')
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta')
      themeColorMeta.setAttribute('name', 'theme-color')
      document.head.append(themeColorMeta)
    }
    themeColorMeta.setAttribute('content', THEME_COLORS[DEFAULT_THEME_MODE])
  })

  it('initializes from storage, updates DOM metadata, and persists user changes across existing and new themes', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'blueprint')
    const onPreferenceError = vi.fn()
    const clearPreferenceNotice = vi.fn()

    const { result } = renderHook(() => useThemePreference({ onPreferenceError, clearPreferenceNotice }))

    expect(result.current.theme).toBe('blueprint')
    expect(document.documentElement.dataset.theme).toBe('blueprint')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', THEME_COLORS.blueprint)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('blueprint')

    act(() => {
      result.current.setTheme('nordic')
    })

    expect(clearPreferenceNotice).toHaveBeenCalledTimes(1)
    expect(result.current.theme).toBe('nordic')
    expect(document.documentElement.dataset.theme).toBe('nordic')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', THEME_COLORS.nordic)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('nordic')
    expect(onPreferenceError).not.toHaveBeenCalled()

    act(() => {
      result.current.setTheme('espresso')
    })

    expect(clearPreferenceNotice).toHaveBeenCalledTimes(2)
    expect(result.current.theme).toBe('espresso')
    expect(document.documentElement.dataset.theme).toBe('espresso')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', THEME_COLORS.espresso)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('espresso')
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

  it('initializes cleanly to monochrome when localStorage.getItem throws during hook mount', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === THEME_STORAGE_KEY) throw new Error('SecurityError: storage access denied')
      return null
    })
    const onPreferenceError = vi.fn()
    const clearPreferenceNotice = vi.fn()

    const { result } = renderHook(() => useThemePreference({ onPreferenceError, clearPreferenceNotice }))

    expect(result.current.theme).toBe('monochrome')
    expect(document.documentElement.dataset.theme).toBe('monochrome')
    expect(onPreferenceError).not.toHaveBeenCalled()
  })
})
