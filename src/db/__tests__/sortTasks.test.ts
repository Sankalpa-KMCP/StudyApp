import { describe, expect, it } from 'vitest'
import { sortTasks } from '../selectors/sortTasks'
import type { TaskItem } from '../types'

function task(overrides: Partial<TaskItem> & { id: number }): TaskItem {
  return {
    text: 't',
    completed: false,
    createdAt: 0,
    estimatedCycles: 1,
    actualCycles: 0,
    ...overrides,
  }
}

describe('sortTasks', () => {
  it('sorts incomplete before complete and high priority first', () => {
    const sorted = sortTasks([
      task({ id: 1, completed: true, priority: 'high' }),
      task({ id: 2, completed: false, priority: 'low', createdAt: 100 }),
      task({ id: 3, completed: false, priority: 'high', createdAt: 50 }),
    ])
    expect(sorted.map(t => t.id)).toEqual([3, 2, 1])
  })
})
