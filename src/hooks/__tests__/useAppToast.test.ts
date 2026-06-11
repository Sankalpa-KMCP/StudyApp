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

  it('honors undo toast duration and action options', () => {
    const onUndo = vi.fn()
    const { result } = renderHook(() => useAppToast())

    act(() => {
      result.current.pushToast('UNDO', 'Deleted', {
        durationMs: 5000,
        action: { label: 'Undo', onClick: onUndo },
      })
    })

    expect(result.current.activeToast?.action?.label).toBe('Undo')
    act(() => {
      result.current.activeToast?.action?.onClick()
    })
    expect(onUndo).toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(4500)
    })
    expect(result.current.activeToast).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(result.current.activeToast).toBeNull()
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
