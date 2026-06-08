import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  categoriesMap: new Map(),
  activeTaskId: null,
  setActiveTaskId: vi.fn(),
  toggleTask: vi.fn(),
  submitRecallGrade: vi.fn(),
}

describe('TaskList virtualization', () => {
  it('shows first 50 tasks and Show more when list exceeds 100', async () => {
    const user = userEvent.setup()
    render(<TaskList {...baseProps} activeTasksList={makeTasks(150)} />)

    expect(screen.getByText('Task 1')).toBeInTheDocument()
    expect(screen.getByText('Task 50')).toBeInTheDocument()
    expect(screen.queryByText('Task 51')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show more/i }))
    expect(screen.getByText('Task 100')).toBeInTheDocument()
    expect(screen.queryByText('Task 101')).not.toBeInTheDocument()
  })
})
