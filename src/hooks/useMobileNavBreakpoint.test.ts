import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMobileNavBreakpoint } from './useMobileNavBreakpoint'
import { MOBILE_NAV_MAX_WIDTH_QUERY } from '../navigation/navDestinations'

describe('useMobileNavBreakpoint', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('tracks matchMedia for the mobile navigation query', () => {
    let matches = false
    const listeners = new Set<() => void>()
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      get matches() {
        return query === MOBILE_NAV_MAX_WIDTH_QUERY ? matches : false
      },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (_event: string, listener: EventListenerOrEventListenerObject) => {
        listeners.add(typeof listener === 'function' ? listener : () => listener.handleEvent(new Event('change')))
      },
      removeEventListener: (_event: string, listener: EventListenerOrEventListenerObject) => {
        listeners.delete(typeof listener === 'function' ? listener : () => listener.handleEvent(new Event('change')))
      },
      dispatchEvent: vi.fn(),
    }))

    const { result } = renderHook(() => useMobileNavBreakpoint())
    expect(result.current).toBe(false)

    matches = true
    act(() => {
      listeners.forEach((listener) => listener())
    })
    expect(result.current).toBe(true)
  })
})
