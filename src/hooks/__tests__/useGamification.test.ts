import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGamification } from '../useGamification'

describe('useGamification', () => {
  it('fires level-up toast when XP level increases', async () => {
    const pushToast = vi.fn()
    const logs = [{ dateString: '2026-06-10', studyMinutes: 100 }]

    const { rerender } = renderHook(
      ({ allLogs }) => useGamification({ allLogs, isDataReady: true, pushToast }),
      { initialProps: { allLogs: logs } },
    )

    await waitFor(() => expect(pushToast).not.toHaveBeenCalled())

    rerender({ allLogs: [{ dateString: '2026-06-10', studyMinutes: 500 }] })

    await waitFor(() => {
      expect(pushToast).toHaveBeenCalledWith('LEVEL UP', expect.stringContaining('Level'))
    })
  })
})
