import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { StudySubject, StudyTask } from '../db/types'
import { TasksView } from './TasksView'

function createSampleTasks(count: number, subjectId = 'sub-1'): StudyTask[] {
  const tasks: StudyTask[] = []
  for (let i = 1; i <= count; i++) {
    tasks.push({
      id: `task-${i}`,
      title: `Task Number ${i}`,
      subjectId,
      dueDate: '2026-09-01',
      priority: 'normal',
      status: i % 2 === 0 ? 'done' : 'open',
      minutes: 30,
      createdAt: new Date(2026, 0, 1, 0, i).toISOString(),
      updatedAt: new Date(2026, 0, 1, 0, i).toISOString(),
    })
  }
  return tasks
}

const sampleSubjects: StudySubject[] = [
  {
    id: 'sub-1',
    name: 'Mathematics',
    color: '#2563eb',
    targetHours: 10,
    progress: 50,
    progressMode: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

describe('TasksView Progressive Bounding (S6.2a)', () => {
  it('renders at most 50 tasks initially when dataset exceeds 50', () => {
    const tasks = createSampleTasks(120)
    render(
      <TasksView
        tasks={tasks}
        subjects={sampleSubjects}
        filter="all"
        search=""
        onClearSearch={vi.fn()}
        openEditorRequest={0}
        onFilterChange={vi.fn()}
        databaseGeneration={1}
      />,
    )

    // Heading elements for tasks
    const taskHeadings = screen.getAllByRole('heading', { level: 3 })
    expect(taskHeadings).toHaveLength(50)
    expect(screen.getByText('Task Number 1')).toBeInTheDocument()
    expect(screen.getByText('Task Number 50')).toBeInTheDocument()
    expect(screen.queryByText('Task Number 51')).not.toBeInTheDocument()

    // Status summary and button
    expect(screen.getByText('Showing 50 of 120 tasks')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show 50 more tasks' })).toBeInTheDocument()
  })

  it('renders all tasks without disclosure footer when dataset has <= 50 tasks', () => {
    const tasks = createSampleTasks(35)
    render(
      <TasksView
        tasks={tasks}
        subjects={sampleSubjects}
        filter="all"
        search=""
        onClearSearch={vi.fn()}
        openEditorRequest={0}
        onFilterChange={vi.fn()}
        databaseGeneration={1}
      />,
    )

    const taskHeadings = screen.getAllByRole('heading', { level: 3 })
    expect(taskHeadings).toHaveLength(35)
    expect(screen.queryByRole('button', { name: /Show .* more tasks/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Showing .* of .* tasks/i)).not.toBeInTheDocument()
  })

  it('reveals next batch (+50) on activation and expands progressively to completion', async () => {
    const user = userEvent.setup()
    const tasks = createSampleTasks(120)
    render(
      <TasksView
        tasks={tasks}
        subjects={sampleSubjects}
        filter="all"
        search=""
        onClearSearch={vi.fn()}
        openEditorRequest={0}
        onFilterChange={vi.fn()}
        databaseGeneration={1}
      />,
    )

    // Initial: 50 visible
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(50)

    // First click: reveals up to 100
    const showMoreButton = screen.getByRole('button', { name: 'Show 50 more tasks' })
    await user.click(showMoreButton)

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(100)
    expect(screen.getByText('Task Number 100')).toBeInTheDocument()
    expect(screen.getByText('Showing 100 of 120 tasks')).toBeInTheDocument()

    // Second click (final expansion): reveals all 120
    const finalShowMore = screen.getByRole('button', { name: 'Show 50 more tasks' })
    await user.click(finalShowMore)

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(120)
    expect(screen.getByText('Task Number 120')).toBeInTheDocument()
    expect(screen.getByText('Showing all 120 tasks')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Show .* more tasks/i })).not.toBeInTheDocument()
  })

  it('safely retains focus on list footer during final expansion without losing focus to body', async () => {
    const user = userEvent.setup()
    const tasks = createSampleTasks(60)
    render(
      <TasksView
        tasks={tasks}
        subjects={sampleSubjects}
        filter="all"
        search=""
        onClearSearch={vi.fn()}
        openEditorRequest={0}
        onFilterChange={vi.fn()}
        databaseGeneration={1}
      />,
    )

    const showMoreBtn = screen.getByRole('button', { name: 'Show 50 more tasks' })
    showMoreBtn.focus()
    expect(document.activeElement).toBe(showMoreBtn)

    await user.click(showMoreBtn)

    // All 60 are now shown, button is unmounted. Focus must not be on body.
    expect(document.activeElement).not.toBe(document.body)
    const footer = screen.getByText('Showing all 60 tasks').closest('.list-disclosure-footer')
    expect(document.activeElement).toBe(footer)
  })

  it('resets visible count to 50 when filter or search changes', async () => {
    const user = userEvent.setup()
    const allTasks = createSampleTasks(120)
    const onFilterChange = vi.fn()

    const { rerender } = render(
      <TasksView
        tasks={allTasks}
        subjects={sampleSubjects}
        filter="all"
        search=""
        onClearSearch={vi.fn()}
        openEditorRequest={0}
        onFilterChange={onFilterChange}
        databaseGeneration={1}
      />,
    )

    // Expand to 100
    await user.click(screen.getByRole('button', { name: 'Show 50 more tasks' }))
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(100)

    // Filter changes to 'open' (only 60 tasks)
    const openTasks = allTasks.filter((t) => t.status === 'open')
    rerender(
      <TasksView
        tasks={openTasks}
        subjects={sampleSubjects}
        filter="open"
        search=""
        onClearSearch={vi.fn()}
        openEditorRequest={0}
        onFilterChange={onFilterChange}
        databaseGeneration={1}
      />,
    )

    // Sliced back to 50
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(50)
    expect(screen.getByText('Showing 50 of 60 tasks')).toBeInTheDocument()

    // Expand to 60
    await user.click(screen.getByRole('button', { name: 'Show 50 more tasks' }))
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(60)

    // Search changes
    rerender(
      <TasksView
        tasks={openTasks}
        subjects={sampleSubjects}
        filter="open"
        search="Number 1"
        onClearSearch={vi.fn()}
        openEditorRequest={0}
        onFilterChange={onFilterChange}
        databaseGeneration={1}
      />,
    )

    // Reset back to initial 50
    expect(screen.getByText('Showing 50 of 60 tasks')).toBeInTheDocument()
  })

  it('does not reset expansion when a task status toggles or a record is edited in place', async () => {
    const user = userEvent.setup()
    const tasks = createSampleTasks(120)

    const { rerender } = render(
      <TasksView
        tasks={tasks}
        subjects={sampleSubjects}
        filter="all"
        search=""
        onClearSearch={vi.fn()}
        openEditorRequest={0}
        onFilterChange={vi.fn()}
        databaseGeneration={1}
      />,
    )

    // Expand to 100
    await user.click(screen.getByRole('button', { name: 'Show 50 more tasks' }))
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(100)

    // Mutate task #1 in place and simulate live-query rerender with databaseGeneration updated
    const updatedTasks = tasks.map((t) => (t.id === 'task-1' ? { ...t, status: 'done' as const } : t))
    rerender(
      <TasksView
        tasks={updatedTasks}
        subjects={sampleSubjects}
        filter="all"
        search=""
        onClearSearch={vi.fn()}
        openEditorRequest={0}
        onFilterChange={vi.fn()}
        databaseGeneration={2}
      />,
    )

    // Still expanded to 100
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(100)
    expect(screen.getByText('Showing 100 of 120 tasks')).toBeInTheDocument()
  })

  it('handles deletion gracefully and fills the visible window from remaining pool without blank ranges', async () => {
    const tasks = createSampleTasks(120)

    const { rerender } = render(
      <TasksView
        tasks={tasks}
        subjects={sampleSubjects}
        filter="all"
        search=""
        onClearSearch={vi.fn()}
        openEditorRequest={0}
        onFilterChange={vi.fn()}
        databaseGeneration={1}
      />,
    )

    // Initially 50
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(50)
    expect(screen.getByText('Task Number 50')).toBeInTheDocument()

    // Delete task-1 from dataset
    const remainingTasks = tasks.filter((t) => t.id !== 'task-1')
    rerender(
      <TasksView
        tasks={remainingTasks}
        subjects={sampleSubjects}
        filter="all"
        search=""
        onClearSearch={vi.fn()}
        openEditorRequest={0}
        onFilterChange={vi.fn()}
        databaseGeneration={2}
      />,
    )

    // 50 tasks still rendered, task 51 has moved into the 50th visible position
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(50)
    expect(screen.queryByText('Task Number 1')).not.toBeInTheDocument()
    expect(screen.getByText('Task Number 51')).toBeInTheDocument()
    expect(screen.getByText('Showing 50 of 119 tasks')).toBeInTheDocument()
  })
})
