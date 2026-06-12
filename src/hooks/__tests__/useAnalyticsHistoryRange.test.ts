import { afterEach, describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { db } from '../../db/db'
import { useAnalyticsHistoryRange } from '../useAnalyticsHistoryRange'

afterEach(async () => {
  localStorage.clear()
  await db.history.clear()
})

describe('useAnalyticsHistoryRange', () => {
  it('defaults to 30d when storage empty', async () => {
    const { result } = renderHook(() => useAnalyticsHistoryRange())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.range).toBe('30d')
    expect(result.current.rangeLabel).toBe('Last 30 days')
  })

  it('loads history within selected range', async () => {
    const now = Date.now()
    await db.history.bulkAdd([
      { timestamp: 'recent', createdAt: now - 2 * 24 * 60 * 60 * 1000, type: 'study', durationMinutes: 25 },
      { timestamp: 'old', createdAt: now - 40 * 24 * 60 * 60 * 1000, type: 'study', durationMinutes: 25 },
    ])

    const { result } = renderHook(() => useAnalyticsHistoryRange())
    await waitFor(() => expect(result.current.history.length).toBe(1))

    result.current.setRange('all')
    await waitFor(() => expect(result.current.history.length).toBe(2))
  })
})
