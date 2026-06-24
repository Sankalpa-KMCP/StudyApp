import type React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskRegistry } from '../TaskRegistry'
import { ConfirmProvider } from '../../context/ConfirmProvider'
import type { CategoryItem } from '../../db/types'

function renderRegistry(props: React.ComponentProps<typeof TaskRegistry>) {
  return render(
    <ConfirmProvider>
      <TaskRegistry {...props} />
    </ConfirmProvider>,
  )
}

const baseProps = {
  categories: [] as CategoryItem[],
  addCategory: vi.fn().mockResolvedValue(1),
  deleteCategory: vi.fn(),
  activeTaskId: null,
  setActiveTaskId: vi.fn(),
  activateTask: vi.fn(),
  toggleTask: vi.fn(),
  updateSubtasks: vi.fn(),
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
    renderRegistry({ ...baseProps, tasks: [] })
    expect(screen.getByText('Focus targets')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('What do you want to focus on?')).toBeInTheDocument()
    expect(screen.getByText('✏️ Manage')).toBeInTheDocument()
  })

  it('submits a new task on Enter with session subject', async () => {
    const user = userEvent.setup()
    const handleAddTask = vi.fn()
    renderRegistry({
      ...baseProps,
      tasks: [],
      handleAddTask,
      timerCategoryId: 2,
      categories: [{ id: 2, name: 'Math', color: '#3B82F6' }],
    })
    const input = screen.getByPlaceholderText('What do you want to focus on?')
    await user.type(input, 'My task{Enter}')
    expect(handleAddTask).toHaveBeenCalledWith('My task', 2, 1, 'medium', false)
  })

  it('activates a task when the target control is clicked', async () => {
    const user = userEvent.setup()
    const activateTask = vi.fn()
    const task = { id: 1, text: 'Existing task', completed: false, createdAt: Date.now(), estimatedCycles: 1, actualCycles: 0 }
    renderRegistry({ ...baseProps, tasks: [task], activateTask })
    await user.click(screen.getByRole('button', { name: 'Select Existing task for timer' }))
    expect(activateTask).toHaveBeenCalledWith(task)
  })

  it('marks a task complete when checkbox is clicked', async () => {
    const user = userEvent.setup()
    const toggleTask = vi.fn().mockResolvedValue(undefined)
    renderRegistry({
      ...baseProps,
      tasks: [{ id: 1, text: 'Existing task', completed: false, createdAt: Date.now(), estimatedCycles: 1, actualCycles: 0 }],
      toggleTask,
    })
    await user.click(screen.getByRole('checkbox', { name: 'Mark task complete' }))
    expect(toggleTask).toHaveBeenCalledWith(1)
  })
})
