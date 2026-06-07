import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { db } from '../db'
import { resetDatabase } from '../../test/dbTestUtils'
import { getRecentHistory } from '../repositories/history'
import { useRecentHistory } from '../hooks/useHistory'
import { addHistoryEntry } from '../repositories/history'

describe('getRecentHistory', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('returns entries newest-first up to the limit', async () => {
    for (let i = 0; i < 5; i++) {
      await addHistoryEntry({
        type: 'study',
        durationMinutes: 25,
        timestamp: `2026-06-10 10:0${i}:00`,
        createdAt: Date.now() + i,
      })
    }
    const recent = await getRecentHistory(3)
    expect(recent).toHaveLength(3)
  })
})

describe('useRecentHistory', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('starts loading then returns history from the database', async () => {
    await db.history.add({
      type: 'study',
      durationMinutes: 25,
      timestamp: '2026-06-10 10:00:00',
      createdAt: Date.now(),
    })

    const { result } = renderHook(() => useRecentHistory(10))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.history).toHaveLength(1)
    expect(result.current.history[0].durationMinutes).toBe(25)
  })

  it('respects the limit argument', async () => {
    for (let i = 0; i < 4; i++) {
      await db.history.add({
        type: 'study',
        durationMinutes: 25,
        timestamp: `2026-06-10 10:0${i}:00`,
        createdAt: Date.now() + i,
      })
    }

    const { result } = renderHook(() => useRecentHistory(2))

    await waitFor(() => {
      expect(result.current.history).toHaveLength(2)
    })
  })
})
