import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMonthLogsQuery } from '../hooks'
import { resetDatabase, seedDailyLog } from '../../test/dbTestUtils'

describe('useMonthLogsQuery', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('returns only logs for the requested month', async () => {
    await seedDailyLog('2026-06-10', 60)
    await seedDailyLog('2026-06-15', 30)
    await seedDailyLog('2026-07-01', 45)

    const { result } = renderHook(() => useMonthLogsQuery(5, 2026))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.monthLogs).toHaveLength(2)
    expect(result.current.totalMonthHours).toBe(1.5)
  })
})
