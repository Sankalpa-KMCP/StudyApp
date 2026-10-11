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
    const listeners = new Set<EventListenerOrEventListenerObject>()
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      get matches() {
        return query === MOBILE_NAV_MAX_WIDTH_QUERY ? matches : false
      },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (_event: string, listener: EventListenerOrEventListenerObject) => {
        listeners.add(listener)
      },
      removeEventListener: (_event: string, listener: EventListenerOrEventListenerObject) => {
        listeners.delete(listener)
      },
      dispatchEvent: vi.fn(),
    }))

    const { result } = renderHook(() => useMobileNavBreakpoint())
    expect(result.current).toBe(false)

    matches = true
    act(() => {
      listeners.forEach((listener) => typeof listener === 'function' ? listener(new Event('change')) : listener.handleEvent(new Event('change')))
    })
    expect(result.current).toBe(true)
  })
})
