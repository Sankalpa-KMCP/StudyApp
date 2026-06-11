import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTimerReflection } from '../useTimerReflection'

describe('useTimerReflection', () => {
  const completingRef = { current: true }
  const processSessionCompletion = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    completingRef.current = true
    processSessionCompletion.mockClear()
  })

  it('skipReflection submits default ratings and empty notes', async () => {
    const { result } = renderHook(() =>
      useTimerReflection({ completingRef, processSessionCompletion }),
    )

    act(() => {
      result.current.openReflection({
        elapsed: 1500,
        mode: 'study',
        timestamp: '2026-01-01 12:00',
        categoryId: 1,
      })
    })

    await act(async () => {
      await result.current.skipReflection()
    })

    expect(processSessionCompletion).toHaveBeenCalledWith(
      1500,
      'study',
      '2026-01-01 12:00',
      1,
      4,
      4,
      '',
    )
    expect(result.current.showReflectionModal).toBe(false)
  })
})
