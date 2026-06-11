import { useCallback, useMemo, useState } from 'react'
import type { FlashcardItem } from '../../db/types'
import { isFlashcardDue, todayISO } from './flashcardDue'

export function useFlashcardFilters(flashcards: FlashcardItem[]) {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | number>('all')
  const [activeSpacingFilter, setActiveSpacingFilter] = useState<'all' | 'due' | 'new' | 'completed'>('all')

  const todayStr = useMemo(() => todayISO(), [])

  const isDue = useCallback(
    (card: FlashcardItem) => isFlashcardDue(card, todayStr),
    [todayStr],
  )

  const filteredCards = useMemo(() => {
    return flashcards.filter(c => {
      const matchesCategory = activeCategoryFilter === 'all' || c.categoryId === activeCategoryFilter
      if (!matchesCategory) return false
      if (activeSpacingFilter === 'all') return true
      if (activeSpacingFilter === 'new') return c.latestGrade === undefined
      if (activeSpacingFilter === 'due') return c.latestGrade !== undefined && isDue(c)
      if (activeSpacingFilter === 'completed') return c.latestGrade !== undefined && c.nextReviewDate && c.nextReviewDate > todayStr
      return true
    })
  }, [flashcards, activeCategoryFilter, activeSpacingFilter, isDue, todayStr])

  const stats = useMemo(() => {
    const total = filteredCards.length
    const due = filteredCards.filter(isDue).length
    const gradedCards = filteredCards.filter(c => c.latestGrade !== undefined)
    const avgGrade = gradedCards.length > 0
      ? parseFloat((gradedCards.reduce((acc, c) => acc + (c.latestGrade ?? 0), 0) / gradedCards.length).toFixed(1))
      : 0
    return { total, due, avgGrade }
  }, [filteredCards, isDue])

  return {
    activeCategoryFilter,
    setActiveCategoryFilter,
    activeSpacingFilter,
    setActiveSpacingFilter,
    filteredCards,
    stats,
    isDue,
    todayStr,
  }
}
