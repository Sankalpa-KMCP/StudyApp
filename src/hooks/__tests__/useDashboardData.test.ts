import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDashboardData } from '../useDashboardData'
import { resetDatabase } from '../../test/dbTestUtils'

describe('useDashboardData', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('exposes recentHistory and history mutations', async () => {
    const { result } = renderHook(() => useDashboardData())
    await waitFor(() => expect(result.current.isDataReady).toBe(true))
    expect(result.current.recentHistory.history).toEqual([])
    expect(typeof result.current.history.addEntry).toBe('function')
    expect(typeof result.current.history.clearHistory).toBe('function')
    expect(result.current.history.isLoading).toBe(false)
  })
})
