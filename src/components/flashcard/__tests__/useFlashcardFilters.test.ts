import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFlashcardFilters } from '../useFlashcardFilters'
import type { FlashcardItem } from '../../../db/types'

const TODAY = '2026-06-11'

function makeCard(overrides: Partial<FlashcardItem> & Pick<FlashcardItem, 'id'>): FlashcardItem {
  return {
    question: 'Q',
    answer: 'A',
    createdAt: Date.now(),
    repetitionCount: 0,
    easinessFactor: 2.5,
    intervalDays: 1,
    ...overrides,
  }
}

describe('useFlashcardFilters', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('computes stats for all cards', () => {
    const cards = [
      makeCard({ id: 1, latestGrade: 4, nextReviewDate: TODAY }),
      makeCard({ id: 2, latestGrade: 3, nextReviewDate: '2026-06-12' }),
      makeCard({ id: 3 }),
    ]
    const { result } = renderHook(() => useFlashcardFilters(cards))
    expect(result.current.stats.total).toBe(3)
    expect(result.current.stats.due).toBe(2)
    expect(result.current.stats.avgGrade).toBe(3.5)
  })

  it('filters by category', () => {
    const cards = [
      makeCard({ id: 1, categoryId: 1 }),
      makeCard({ id: 2, categoryId: 2 }),
    ]
    const { result } = renderHook(() => useFlashcardFilters(cards))
    act(() => result.current.setActiveCategoryFilter(1))
    expect(result.current.filteredCards).toHaveLength(1)
    expect(result.current.filteredCards[0].id).toBe(1)
  })

  it('filters new cards (no grade)', () => {
    const cards = [
      makeCard({ id: 1 }),
      makeCard({ id: 2, latestGrade: 4, nextReviewDate: TODAY }),
    ]
    const { result } = renderHook(() => useFlashcardFilters(cards))
    act(() => result.current.setActiveSpacingFilter('new'))
    expect(result.current.filteredCards).toHaveLength(1)
    expect(result.current.filteredCards[0].id).toBe(1)
  })

  it('filters due cards (graded and due)', () => {
    const cards = [
      makeCard({ id: 1, latestGrade: 4, nextReviewDate: TODAY }),
      makeCard({ id: 2, latestGrade: 3, nextReviewDate: '2026-06-12' }),
      makeCard({ id: 3 }),
    ]
    const { result } = renderHook(() => useFlashcardFilters(cards))
    act(() => result.current.setActiveSpacingFilter('due'))
    expect(result.current.filteredCards).toHaveLength(1)
    expect(result.current.filteredCards[0].id).toBe(1)
  })

  it('filters completed cards (graded and not due)', () => {
    const cards = [
      makeCard({ id: 1, latestGrade: 4, nextReviewDate: '2026-06-12' }),
      makeCard({ id: 2, latestGrade: 3, nextReviewDate: TODAY }),
    ]
    const { result } = renderHook(() => useFlashcardFilters(cards))
    act(() => result.current.setActiveSpacingFilter('completed'))
    expect(result.current.filteredCards).toHaveLength(1)
    expect(result.current.filteredCards[0].id).toBe(1)
  })

  it('returns zero stats for empty deck', () => {
    const { result } = renderHook(() => useFlashcardFilters([]))
    expect(result.current.stats).toEqual({ total: 0, due: 0, avgGrade: 0 })
  })
})
