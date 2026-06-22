import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTaskFilters } from '../useTaskFilters'
import type { TaskItem, CategoryItem } from '../../db/types'

const todayStr = '2026-06-11'

const categories: CategoryItem[] = [{ id: 1, name: 'Math', color: '#3B82F6' }]

describe('useTaskFilters', () => {
  it('separates active, review queue, and completed tasks', () => {
    const tasks: TaskItem[] = [
      { id: 1, text: 'Active', completed: false, createdAt: 3, estimatedCycles: 1, actualCycles: 0 },
      { id: 2, text: 'Done', completed: true, createdAt: 2, estimatedCycles: 1, actualCycles: 1 },
      {
        id: 3,
        text: 'Review',
        completed: true,
        isStudySubject: true,
        nextReviewDate: todayStr,
        createdAt: 1,
        estimatedCycles: 1,
        actualCycles: 1,
      },
    ]

    const { result } = renderHook(() => useTaskFilters(tasks, categories, todayStr))

    expect(result.current.activeTasksList).toHaveLength(1)
    expect(result.current.activeTasksList[0].text).toBe('Active')
    expect(result.current.reviewQueueList).toHaveLength(1)
    expect(result.current.reviewQueueList[0].text).toBe('Review')
    expect(result.current.completedTasksList).toHaveLength(1)
    expect(result.current.completedTasksList[0].text).toBe('Done')
  })

  it('sorts completed tasks by createdAt descending', () => {
    const tasks: TaskItem[] = [
      { id: 1, text: 'Older', completed: true, createdAt: 1, estimatedCycles: 1, actualCycles: 1 },
      { id: 2, text: 'Newer', completed: true, createdAt: 10, estimatedCycles: 1, actualCycles: 1 },
    ]

    const { result } = renderHook(() => useTaskFilters(tasks, categories, todayStr))
    expect(result.current.completedTasksList.map(t => t.text)).toEqual(['Newer', 'Older'])
  })
})
