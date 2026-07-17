import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { countReviewDueTasks } from '../../lib/study/taskFilters'
import { useReviewDueCount } from '../useReviewDueCount'
import type { TaskItem } from '../../db/types'

function makeTask(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    text: 'Test',
    completed: false,
    createdAt: Date.now(),
    estimatedCycles: 1,
    actualCycles: 0,
    ...overrides,
  }
}

describe('countReviewDueTasks', () => {
  const today = '2026-06-13'

  it('counts completed study subjects due for review', () => {
    const tasks = [
      makeTask({ completed: true, isStudySubject: true, nextReviewDate: '2026-06-12' }),
      makeTask({ completed: true, isStudySubject: true, nextReviewDate: '2026-06-14' }),
      makeTask({ completed: false, isStudySubject: true }),
    ]
    expect(countReviewDueTasks(tasks, today)).toBe(1)
  })

  it('includes study subjects with no next review date', () => {
    const tasks = [makeTask({ completed: true, isStudySubject: true })]
    expect(countReviewDueTasks(tasks, today)).toBe(1)
  })
})

describe('useReviewDueCount', () => {
  it('returns review due count for tasks', () => {
    const tasks = [
      makeTask({ completed: true, isStudySubject: true, nextReviewDate: '2000-01-01' }),
    ]
    const { result } = renderHook(() => useReviewDueCount(tasks))
    expect(result.current).toBe(1)
  })
})
