import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_DENSITY_MODE,
  DENSITY_STORAGE_KEY,
  isDensityMode,
  readStoredDensity,
  useDensityPreference,
} from './useDensityPreference'

describe('density preference helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    delete document.documentElement.dataset.density
  })

  it('validates density tokens correctly', () => {
    expect(isDensityMode('comfortable')).toBe(true)
    expect(isDensityMode('compact')).toBe(true)
    expect(isDensityMode('sparse')).toBe(false)
    expect(isDensityMode(null)).toBe(false)
    expect(isDensityMode(undefined)).toBe(false)
  })

  it('reads stored density mode and falls back to comfortable on invalid/missing values', () => {
    expect(readStoredDensity()).toBe(DEFAULT_DENSITY_MODE)

    localStorage.setItem(DENSITY_STORAGE_KEY, 'compact')
    expect(readStoredDensity()).toBe('compact')

    localStorage.setItem(DENSITY_STORAGE_KEY, 'invalid')
    expect(readStoredDensity()).toBe('comfortable')
  })

  it('falls back safely when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === DENSITY_STORAGE_KEY) throw new Error('Storage error')
      return null
    })
    expect(readStoredDensity()).toBe('comfortable')
  })
})

describe('useDensityPreference', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    delete document.documentElement.dataset.density
  })

  it('initializes from storage, sets dataset.density, and updates on setDensity', () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, 'compact')
    const onPreferenceError = vi.fn()
    const clearPreferenceNotice = vi.fn()

    const { result } = renderHook(() => useDensityPreference({ onPreferenceError, clearPreferenceNotice }))

    expect(result.current.density).toBe('compact')
    expect(document.documentElement.dataset.density).toBe('compact')
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('compact')

    act(() => {
      result.current.setDensity('comfortable')
    })

    expect(clearPreferenceNotice).toHaveBeenCalledTimes(1)
    expect(result.current.density).toBe('comfortable')
    expect(document.documentElement.dataset.density).toBe('comfortable')
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('comfortable')
    expect(onPreferenceError).not.toHaveBeenCalled()
  })

  it('reports user-initiated persistence failures via onPreferenceError', () => {
    const onPreferenceError = vi.fn()
    const clearPreferenceNotice = vi.fn()

    const { result } = renderHook(() => useDensityPreference({ onPreferenceError, clearPreferenceNotice }))

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      if (key === DENSITY_STORAGE_KEY) throw new Error('QuotaExceeded')
    })

    act(() => {
      result.current.setDensity('compact')
    })

    expect(onPreferenceError).toHaveBeenCalledWith('Density preference could not be saved.')
    expect(result.current.density).toBe('compact')
    expect(document.documentElement.dataset.density).toBe('compact')
  })
})
