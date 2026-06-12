import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TaskList } from '../TaskList'
import type { TaskItem } from '../../../db/types'

function makeTasks(count: number): TaskItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    text: `Task ${i + 1}`,
    completed: false,
    createdAt: Date.now(),
    estimatedCycles: 1,
    actualCycles: 0,
  }))
}

const baseProps = {
  reviewQueueList: [] as TaskItem[],
  completedTasksList: [] as TaskItem[],
  categoriesMap: new Map(),
  activeTaskId: null,
  setActiveTaskId: vi.fn(),
  onActivateTask: vi.fn(),
  toggleTask: vi.fn(),
  submitRecallGrade: vi.fn(),
}

describe('TaskList virtualization', () => {
  it('uses virtual scroll when list exceeds 100 tasks', () => {
    const { container } = render(<TaskList {...baseProps} activeTasksList={makeTasks(150)} />)

    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument()
    const virtualContainer = container.querySelector('[style*="height: 21000px"]')
    expect(virtualContainer).toBeTruthy()
  })

  it('renders all tasks without virtual scroll when under threshold', () => {
    render(<TaskList {...baseProps} activeTasksList={makeTasks(50)} />)
    expect(screen.getByText('Task 50')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument()
  })
})
