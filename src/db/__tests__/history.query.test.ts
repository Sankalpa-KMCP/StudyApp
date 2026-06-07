import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { resetDatabase } from '../../test/dbTestUtils'
import {
  getHistoryForDateRange,
  getMonthBounds,
  getRecentHistory,
} from '../repositories/history'

describe('history queries', () => {
  beforeEach(async () => {
    await resetDatabase()
    await db.history.bulkAdd([
      { type: 'study', durationMinutes: 25, createdAt: new Date(2025, 0, 15).getTime(), timestamp: 'Jan 15' },
      { type: 'study', durationMinutes: 25, createdAt: new Date(2025, 1, 10).getTime(), timestamp: 'Feb 10' },
      { type: 'study', durationMinutes: 25, createdAt: new Date(2025, 2, 5).getTime(), timestamp: 'Mar 5' },
      { type: 'study', durationMinutes: 10, createdAt: Date.now() - 3000, timestamp: 'recent-a' },
      { type: 'study', durationMinutes: 10, createdAt: Date.now() - 2000, timestamp: 'recent-b' },
      { type: 'study', durationMinutes: 10, createdAt: Date.now() - 1000, timestamp: 'recent-c' },
    ])
  })

  it('getHistoryForDateRange returns entries within month bounds', async () => {
    const { start, end } = getMonthBounds(2025, 1)
    const rows = await getHistoryForDateRange(start, end)
    expect(rows).toHaveLength(1)
    expect(rows[0].timestamp).toBe('Feb 10')
  })

  it('getRecentHistory limits results by newest id order', async () => {
    const rows = await getRecentHistory(2)
    expect(rows).toHaveLength(2)
    expect(rows.map(r => r.timestamp)).toEqual(['recent-c', 'recent-b'])
  })
})
