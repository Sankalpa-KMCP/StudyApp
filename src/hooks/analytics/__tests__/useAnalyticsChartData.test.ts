import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRetentionData } from '../useAnalyticsChartData'
import type { TaskItem } from '../../../db/types'

describe('useRetentionData', () => {
  it('calculates average retention grades from completed tasks grouped by date', () => {
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
        completed: false,
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

    const { result } = renderHook(() => useRetentionData(tasks))

    expect(result.current).toEqual([
      { date: '06-11', avgGrade: 4 },
      { date: '06-12', avgGrade: 2 },
    ])
  })

  it('handles empty inputs gracefully', () => {
    const { result } = renderHook(() => useRetentionData([]))
    expect(result.current).toEqual([])
  })
})
