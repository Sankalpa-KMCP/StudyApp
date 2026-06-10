import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAppToast } from '../useAppToast'

describe('useAppToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows toast on dexie-error quota event', () => {
    const { result } = renderHook(() => useAppToast())

    act(() => {
      window.dispatchEvent(new CustomEvent('dexie-error', {
        detail: { name: 'QuotaExceededError', message: 'quota' },
      }))
    })

    expect(result.current.activeToast?.key).toBe('DATABASE')
    expect(result.current.activeToast?.message.toLowerCase()).toContain('quota')
    expect(result.current.quotaExceeded).toBe(true)
  })

  it('dismisses quota recovery flag', () => {
    const { result } = renderHook(() => useAppToast())

    act(() => {
      window.dispatchEvent(new CustomEvent('dexie-error', {
        detail: { name: 'QuotaExceededError', message: 'quota' },
      }))
    })
    expect(result.current.quotaExceeded).toBe(true)

    act(() => {
      result.current.dismissQuotaRecovery()
    })
    expect(result.current.quotaExceeded).toBe(false)
  })

  it('auto-dismisses toast after timeout', () => {
    const { result } = renderHook(() => useAppToast())

    act(() => {
      result.current.pushToast('TEST', 'Hello')
    })
    expect(result.current.activeToast?.message).toBe('Hello')

    act(() => {
      vi.advanceTimersByTime(1600)
    })
    expect(result.current.activeToast).toBeNull()
  })
})
