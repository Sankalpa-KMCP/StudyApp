import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRetentionData } from '../useAnalyticsChartData'
import type { TaskItem, FlashcardItem } from '../../../db/types'

describe('useRetentionData', () => {
  it('combines and calculates average retention grades from both tasks and flashcards grouped by date', () => {
    const date1 = new Date('2026-06-11T10:00:00Z').getTime()
    const date2 = new Date('2026-06-12T10:00:00Z').getTime()

    const tasks: TaskItem[] = [
      {
        text: 'Task 1',
        completed: true,
        createdAt: date1,
        estimatedCycles: 1,
        actualCycles: 1,
        latestGrade: 4,
      },
      {
        text: 'Task 2',
        completed: false, // Should be ignored because not completed
        createdAt: date1,
        estimatedCycles: 1,
        actualCycles: 1,
        latestGrade: 5,
      },
      {
        text: 'Task 3',
        completed: true,
        createdAt: date2,
        estimatedCycles: 1,
        actualCycles: 1,
        latestGrade: 2,
      },
    ]

    const flashcards: FlashcardItem[] = [
      {
        question: 'Q1',
        answer: 'A1',
        createdAt: date1,
        repetitionCount: 1,
        easinessFactor: 2.5,
        intervalDays: 1,
        latestGrade: 5, // Should combine with Task 1 (grade 4) on date1 -> avg (4 + 5)/2 = 4.5
      },
      {
        question: 'Q2',
        answer: 'A2',
        createdAt: date2,
        repetitionCount: 1,
        easinessFactor: 2.5,
        intervalDays: 1,
        // latestGrade undefined -> should be ignored
      },
      {
        question: 'Q3',
        answer: 'A3',
        createdAt: date2,
        repetitionCount: 1,
        easinessFactor: 2.5,
        intervalDays: 1,
        latestGrade: 4, // Should combine with Task 3 (grade 2) on date2 -> avg (2 + 4)/2 = 3.0
      },
    ]

    const { result } = renderHook(() => useRetentionData(tasks, flashcards))

    expect(result.current).toEqual([
      { date: '06-11', avgGrade: 4.5 },
      { date: '06-12', avgGrade: 3.0 },
    ])
  })

  it('handles empty inputs gracefully', () => {
    const { result } = renderHook(() => useRetentionData([], []))
    expect(result.current).toEqual([])
  })
})
