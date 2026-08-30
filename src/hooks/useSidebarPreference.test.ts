import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SIDEBAR_STORAGE_KEY,
  readStoredSidebarCollapsed,
  useSidebarPreference,
} from './useSidebarPreference'

describe('sidebar preference helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('treats only the collapsed token as collapsed', () => {
    expect(readStoredSidebarCollapsed()).toBe(false)

    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'expanded')
    expect(readStoredSidebarCollapsed()).toBe(false)

    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed')
    expect(readStoredSidebarCollapsed()).toBe(true)
  })

  it('falls back to false when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === SIDEBAR_STORAGE_KEY) throw new Error('SecurityError: storage access denied')
      return null
    })
    expect(readStoredSidebarCollapsed()).toBe(false)
  })
})

describe('useSidebarPreference', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('initializes from storage and persists toggles as collapsed or expanded', () => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed')
    const onPreferenceError = vi.fn()
    const clearPreferenceNotice = vi.fn()

    const { result } = renderHook(() => useSidebarPreference({ onPreferenceError, clearPreferenceNotice }))

    expect(result.current.sidebarCollapsed).toBe(true)
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed')

    act(() => {
      result.current.toggleSidebarCollapsed()
    })

    expect(clearPreferenceNotice).toHaveBeenCalledTimes(1)
    expect(result.current.sidebarCollapsed).toBe(false)
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('expanded')
    expect(onPreferenceError).not.toHaveBeenCalled()

    act(() => {
      result.current.toggleSidebarCollapsed()
    })

    expect(result.current.sidebarCollapsed).toBe(true)
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed')
  })

  it('reports a friendly error only for failed user-initiated persistence', () => {
    const onPreferenceError = vi.fn()
    const clearPreferenceNotice = vi.fn()
    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === SIDEBAR_STORAGE_KEY) throw new Error('quota exceeded')
      return originalSetItem.call(this, key, value)
    })

    const { result } = renderHook(() => useSidebarPreference({ onPreferenceError, clearPreferenceNotice }))

    expect(onPreferenceError).not.toHaveBeenCalled()

    act(() => {
      result.current.toggleSidebarCollapsed()
    })

    expect(result.current.sidebarCollapsed).toBe(true)
    expect(onPreferenceError).toHaveBeenCalledWith('Sidebar preference could not be saved.')
    expect(clearPreferenceNotice).toHaveBeenCalledTimes(1)
  })

  it('initializes cleanly to expanded when localStorage.getItem throws during hook mount', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === SIDEBAR_STORAGE_KEY) throw new Error('SecurityError: storage access denied')
      return null
    })
    const onPreferenceError = vi.fn()
    const clearPreferenceNotice = vi.fn()

    const { result } = renderHook(() => useSidebarPreference({ onPreferenceError, clearPreferenceNotice }))

    expect(result.current.sidebarCollapsed).toBe(false)
    expect(onPreferenceError).not.toHaveBeenCalled()
  })
})
