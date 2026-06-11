import { describe, it, expect } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGamification } from '../useGamification'

describe('useGamification', () => {
  it('sets pendingLevelUp when XP level increases', async () => {
    const logs = [{ dateString: '2026-06-10', studyMinutes: 100, breakMinutes: 0 }]

    const { result, rerender } = renderHook(
      ({ allLogs }) => useGamification({ allLogs, isDataReady: true }),
      { initialProps: { allLogs: logs } },
    )

    await waitFor(() => expect(result.current.pendingLevelUp).toBeNull())

    rerender({ allLogs: [{ dateString: '2026-06-10', studyMinutes: 500, breakMinutes: 0 }] })

    await waitFor(() => {
      expect(result.current.pendingLevelUp).toBeGreaterThan(1)
    })

    act(() => result.current.dismissLevelUp())
    expect(result.current.pendingLevelUp).toBeNull()
  })
})
