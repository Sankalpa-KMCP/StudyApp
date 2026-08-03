import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMillisecondsUntilNextLocalMidnight, useCurrentDate } from './useCurrentDate'

describe('getMillisecondsUntilNextLocalMidnight', () => {
  it('uses the next local calendar midnight rather than a fixed 24-hour interval', () => {
    const evening = new Date(2026, 6, 13, 22, 30, 0, 0)
    const nextMidnight = new Date(2026, 6, 14, 0, 0, 0, 0)
    expect(getMillisecondsUntilNextLocalMidnight(evening)).toBe(nextMidnight.getTime() - evening.getTime())
    expect(getMillisecondsUntilNextLocalMidnight(evening)).not.toBe(24 * 60 * 60 * 1000)

    const afternoon = new Date(2026, 6, 14, 15, 0, 0, 0)
    expect(getMillisecondsUntilNextLocalMidnight(afternoon)).toBe(
      new Date(2026, 6, 15, 0, 0, 0, 0).getTime() - afternoon.getTime(),
    )
    expect(getMillisecondsUntilNextLocalMidnight(afternoon)).not.toBe(24 * 60 * 60 * 1000)
  })
})

describe('useCurrentDate', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes from the current controlled system time', () => {
    vi.useFakeTimers()
    const initial = new Date(2026, 6, 13, 15, 0, 0, 0)
    vi.setSystemTime(initial)

    const { result } = renderHook(() => useCurrentDate())

    expect(result.current.getTime()).toBe(initial.getTime())
  })

  it('does not rollover before the next local midnight', () => {
    vi.useFakeTimers()
    const initial = new Date(2026, 6, 13, 20, 0, 0, 0)
    vi.setSystemTime(initial)
    const { result } = renderHook(() => useCurrentDate())

    act(() => {
      vi.advanceTimersByTime(getMillisecondsUntilNextLocalMidnight(initial) - 1)
    })

    expect(result.current.getTime()).toBe(initial.getTime())
  })

  it('updates after local midnight and reschedules the following local midnight', () => {
    vi.useFakeTimers()
    const initial = new Date(2026, 6, 13, 22, 0, 0, 0)
    vi.setSystemTime(initial)
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

    const { result } = renderHook(() => useCurrentDate())
    const firstDelay = getMillisecondsUntilNextLocalMidnight(initial)
    expect(firstDelay).toBe(new Date(2026, 6, 14, 0, 0, 0, 0).getTime() - initial.getTime())
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), firstDelay)

    act(() => {
      vi.advanceTimersByTime(firstDelay)
    })

    const afterFirstMidnight = new Date(2026, 6, 14, 0, 0, 0, 0)
    expect(result.current.getTime()).toBe(afterFirstMidnight.getTime())

    const secondDelay = getMillisecondsUntilNextLocalMidnight(afterFirstMidnight)
    expect(secondDelay).toBe(new Date(2026, 6, 15, 0, 0, 0, 0).getTime() - afterFirstMidnight.getTime())
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), secondDelay)

    act(() => {
      vi.advanceTimersByTime(secondDelay)
    })

    expect(result.current.getTime()).toBe(new Date(2026, 6, 15, 0, 0, 0, 0).getTime())
  })

  it('reads the actual callback time when the midnight timer fires late', () => {
    vi.useFakeTimers()
    const initial = new Date(2026, 6, 13, 22, 0, 0, 0)
    vi.setSystemTime(initial)
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

    const { result } = renderHook(() => useCurrentDate())
    const scheduledDelay = getMillisecondsUntilNextLocalMidnight(initial)
    const scheduledCall = setTimeoutSpy.mock.calls.find(
      (call) => typeof call[0] === 'function' && call[1] === scheduledDelay,
    )
    expect(scheduledCall).toBeDefined()
    const tick = scheduledCall![0] as () => void

    // Simulate a deferred background callback: clear the queued timer, jump past midnight,
    // then invoke the captured callback so it observes the late wall clock.
    vi.clearAllTimers()
    const lateNow = new Date(2026, 6, 14, 3, 15, 0, 0)
    vi.setSystemTime(lateNow)

    act(() => {
      tick()
    })

    expect(result.current.getTime()).toBe(lateNow.getTime())

    const rescheduleDelay = getMillisecondsUntilNextLocalMidnight(lateNow)
    expect(rescheduleDelay).toBe(new Date(2026, 6, 15, 0, 0, 0, 0).getTime() - lateNow.getTime())
    expect(rescheduleDelay).not.toBe(24 * 60 * 60 * 1000)
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), rescheduleDelay)
  })

  it('clears the pending timer on unmount and does not update afterward', () => {
    vi.useFakeTimers()
    const initial = new Date(2026, 6, 13, 23, 0, 0, 0)
    vi.setSystemTime(initial)
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    const { result, unmount } = renderHook(() => useCurrentDate())
    const pendingDelay = getMillisecondsUntilNextLocalMidnight(initial)

    unmount()
    expect(clearTimeoutSpy).toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(pendingDelay + 60_000)
    })

    expect(result.current.getTime()).toBe(initial.getTime())
  })
})
