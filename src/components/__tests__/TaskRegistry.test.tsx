import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskRegistry } from '../TaskRegistry'
import type { CategoryItem } from '../../db/types'

const baseProps = {
  categories: [] as CategoryItem[],
  activeTaskId: null,
  setActiveTaskId: vi.fn(),
  toggleTask: vi.fn(),
  handleAddTask: vi.fn(),
  submitRecallGrade: vi.fn(),
  timerCategoryId: undefined,
  setTimerCategoryId: vi.fn(),
  timerMode: 'study' as const,
  taskCycleCount: 1,
  setTaskCycleCount: vi.fn(),
}

describe('TaskRegistry', () => {
  it('renders focus registry and task input', () => {
    render(<TaskRegistry {...baseProps} tasks={[]} />)
    expect(screen.getByText('Focus targets')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('What do you want to focus on?')).toBeInTheDocument()
  })

  it('submits a new task on Enter', async () => {
    const user = userEvent.setup()
    const handleAddTask = vi.fn()
    render(<TaskRegistry {...baseProps} tasks={[]} handleAddTask={handleAddTask} />)
    const input = screen.getByPlaceholderText('What do you want to focus on?')
    await user.type(input, 'My task{Enter}')
    expect(handleAddTask).toHaveBeenCalledWith('My task', undefined, 1, 'medium', false)
  })

  it('marks a task complete when checkbox is clicked', async () => {
    const user = userEvent.setup()
    const toggleTask = vi.fn().mockResolvedValue(undefined)
    render(
      <TaskRegistry
        {...baseProps}
        tasks={[{ id: 1, text: 'Existing task', completed: false, createdAt: Date.now(), estimatedCycles: 1, actualCycles: 0 }]}
        toggleTask={toggleTask}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Mark task complete' }))
    expect(toggleTask).toHaveBeenCalledWith(1)
  })
})
