import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskRegistry } from '../TaskRegistry'
import type { CategoryItem } from '../../db/types'

const baseProps = {
  categories: [] as CategoryItem[],
  addCategory: vi.fn().mockResolvedValue(1),
  deleteCategory: vi.fn(),
  activeTaskId: null,
  setActiveTaskId: vi.fn(),
  activateTask: vi.fn(),
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
    expect(screen.getByText('✏️ Manage')).toBeInTheDocument()
  })

  it('submits a new task on Enter with session subject', async () => {
    const user = userEvent.setup()
    const handleAddTask = vi.fn()
    render(
      <TaskRegistry
        {...baseProps}
        tasks={[]}
        handleAddTask={handleAddTask}
        timerCategoryId={2}
        categories={[{ id: 2, name: 'Math', color: '#3B82F6' }]}
      />,
    )
    const input = screen.getByPlaceholderText('What do you want to focus on?')
    await user.type(input, 'My task{Enter}')
    expect(handleAddTask).toHaveBeenCalledWith('My task', 2, 1, 'medium', false)
  })

  it('activates a task when a row is clicked', async () => {
    const user = userEvent.setup()
    const activateTask = vi.fn()
    const task = { id: 1, text: 'Existing task', completed: false, createdAt: Date.now(), estimatedCycles: 1, actualCycles: 0 }
    render(
      <TaskRegistry
        {...baseProps}
        tasks={[task]}
        activateTask={activateTask}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Task Existing task' }))
    expect(activateTask).toHaveBeenCalledWith(task)
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
