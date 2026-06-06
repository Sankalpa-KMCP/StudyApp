import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TaskRegistry } from '../TaskRegistry'

describe('TaskRegistry', () => {
  it('renders focus registry and task input', () => {
    render(
      <TaskRegistry
        tasks={[]}
        categories={[]}
        activeTaskId={null}
        setActiveTaskId={vi.fn()}
        toggleTask={vi.fn()}
        handleAddTask={vi.fn()}
        submitRecallGrade={vi.fn()}
        timerCategoryId={undefined}
        setTimerCategoryId={vi.fn()}
        timerMode="study"
        taskCycleCount={1}
        setTaskCycleCount={vi.fn()}
      />,
    )
    expect(screen.getByText('Focus Registry')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Create focus target...')).toBeInTheDocument()
  })
})
