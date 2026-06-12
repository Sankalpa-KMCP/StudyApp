import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDashboardData } from '../useDashboardData'
import { resetDatabase } from '../../test/dbTestUtils'
import { db } from '../../db/db'
import * as flashcardRepo from '../../db/repositories/flashcards'

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

  it('skips flashcard query when flashcardsEnabled is false', async () => {
    await db.settings.put({ key: 'flashcardsEnabled', value: false })
    await flashcardRepo.addFlashcard('Q1', 'A1')

    const { result } = renderHook(() => useDashboardData())
    await waitFor(() => expect(result.current.isDataReady).toBe(true))

    expect(result.current.settings.flashcardsEnabled).toBe(false)
    expect(result.current.flashcards.flashcards).toEqual([])
    expect(result.current.flashcards.isLoading).toBe(false)

    const id = await result.current.flashcards.addFlashcard('Q2', 'A2')
    expect(id).toBe(0)
    expect(await db.flashcards.count()).toBe(1)
  })
})
