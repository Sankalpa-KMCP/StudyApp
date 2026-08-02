import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { formatShortTime, toInputDate, toInputTime } from './appUtils'
import {
  ACTIVE_FOCUS_SESSION_KEY,
  ACTIVE_FOCUS_SESSION_STALE_AFTER_MS,
  clearActiveFocusSession,
  createActiveFocusSession,
  discardActiveFocusSession,
  finalizeActiveFocusSession,
  getActiveFocusSession,
  pauseActiveFocusSession,
} from './db/activeFocusSession'
import { studyDb } from './db/studyDb'
import type { ActiveFocusSession } from './db/types'

async function waitForFocusStartEnabled() {
  const startButton = await screen.findByRole('button', { name: 'Start focus' })
  await waitFor(() => expect(startButton).toBeEnabled())
  return startButton
}

function makeDurableFocusSession(overrides: Partial<ActiveFocusSession> = {}): ActiveFocusSession {
  return {
    id: 'focus-restored',
    subjectId: 'subject-focus',
    startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    plannedMinutes: 25,
    status: 'running',
    pausedAt: null,
    accumulatedPausedMs: 0,
    ...overrides,
  }
}

function makeEmptyExport(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    exportedAt: '2026-06-29T00:00:00.000Z',
    tasks: [],
    subjects: [],
    notes: [],
    events: [],
    flashcards: [],
    studySessions: [],
    goals: [],
    settings: [],
    ...overrides,
  }
}

async function importStudyExport(user: ReturnType<typeof userEvent.setup>, payload: unknown, filename = 'backup.json') {
  await user.click(await screen.findByRole('button', { name: 'Settings' }))
  const importInput = screen.getByLabelText(/Import data/)
  await user.upload(importInput, new File([JSON.stringify(payload)], filename, { type: 'application/json' }))
}

const THEME_CASES = [
  ['monochrome', '#111111'],
  ['light', '#f4f0e8'],
  ['dark', '#10141d'],
  ['aurora', '#111323'],
  ['ember', '#f3e4d2'],
  ['blueprint', '#153f73'],
  ['moss', '#294633'],
] as const

describe('App', () => {
  beforeEach(async () => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    localStorage.clear()
    document.documentElement.dataset.theme = 'monochrome'
    let themeColorMeta = document.querySelector('meta[name="theme-color"]')
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta')
      themeColorMeta.setAttribute('name', 'theme-color')
      document.head.append(themeColorMeta)
    }
    themeColorMeta.setAttribute('content', '#111111')
    await studyDb.delete()
    await studyDb.open()
  })

  it('renders an empty database-backed dashboard shell', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Good morning' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Study Tasks' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Weekly Progress' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toHaveClass('is-active')
    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
    expect(screen.queryByText('Chemistry lab report')).not.toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('monochrome')
    expect(localStorage.getItem('study-dashboard-theme')).toBe('monochrome')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#111111')

    const checklist = screen.getByRole('region', { name: 'Your first study loop' })
    const progress = within(checklist).getByRole('progressbar', { name: 'First study loop progress' })
    expect(progress).toHaveAttribute('aria-valuenow', '0')
    expect(progress).toHaveAttribute('aria-valuetext', '0 of 3 steps complete')
    expect(within(checklist).getByRole('button', { name: 'Create subject' })).toBeInTheDocument()
    expect(within(checklist).getByRole('button', { name: 'Plan task' })).toBeInTheDocument()
    expect(within(checklist).getByRole('button', { name: 'Log session' })).toBeInTheDocument()
  })

  it('keeps a single Home h1 and exposes the topbar label outside the heading outline', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Good morning' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2, name: 'Study Tasks' })).toBeInTheDocument()

    const topbar = document.querySelector('.topbar')
    expect(topbar).not.toBeNull()
    expect(within(topbar as HTMLElement).getByText('Dashboard')).toBeInTheDocument()
    expect(within(topbar as HTMLElement).queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument()
  })

  it('keeps a single Tasks workspace h1 while the topbar view label stays visible non-heading chrome', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Tasks' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)

    const topbar = document.querySelector('.topbar')
    expect(topbar).not.toBeNull()
    expect(within(topbar as HTMLElement).getByText('Tasks')).toBeInTheDocument()
    expect(within(topbar as HTMLElement).queryByRole('heading')).not.toBeInTheDocument()
  })

  it('names task toggles without exposing nested decorative icons', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.tasks.add({
      id: 'task-a11y-toggle',
      title: 'Accessible toggle task',
      subjectId: '',
      status: 'open',
      priority: 'normal',
      minutes: 30,
      dueDate: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Tasks' }))

    const toggle = await screen.findByRole('button', { name: 'Toggle Accessible toggle task' })
    expect(toggle).toHaveAccessibleName('Toggle Accessible toggle task')
    expect(within(toggle).queryByRole('img')).not.toBeInTheDocument()
    expect(toggle.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('exposes human-readable subject swatch names and persists the exact hex value', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Subjects' }))
    await user.click(screen.getByRole('button', { name: 'New subject' }))

    expect(screen.getByRole('button', { name: 'Use blue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use teal' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Use #/ })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Subject name'), 'Named swatch subject')
    await user.click(screen.getByRole('button', { name: 'Use amber' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Named swatch subject')).toBeInTheDocument()
    expect((await studyDb.subjects.toArray())[0].color).toBe('#b45309')
  })

  it('derives checklist progress from subjects, tasks or events, and sessions with live updates', async () => {
    await addFirstStudySubject()
    render(<App />)

    const checklist = await screen.findByRole('region', { name: 'Your first study loop' })
    expect(within(checklist).getByRole('progressbar', { name: 'First study loop progress' })).toHaveAttribute('aria-valuenow', '1')
    expect(within(screen.getByRole('heading', { name: 'Create a subject' }).closest('li')! as HTMLElement).getByText('Complete')).toBeInTheDocument()

    await studyDb.tasks.add({
      id: 'first-study-task',
      title: 'Review chapter one',
      subjectId: 'first-study-subject',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: FIRST_STUDY_TIMESTAMP,
      updatedAt: FIRST_STUDY_TIMESTAMP,
    })
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Your first study loop' })).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2'))

    await studyDb.tasks.delete('first-study-task')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Plan task' })).toBeInTheDocument())

    await addFirstStudyEvent()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Plan task' })).not.toBeInTheDocument())

    await addFirstStudySession()
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Your first study loop' })).not.toBeInTheDocument())

    await studyDb.studySessions.delete('first-study-session')
    expect(await screen.findByRole('region', { name: 'Your first study loop' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log session' })).toBeInTheDocument()
  })

  it('keeps the checklist hidden for existing users who completed the study loop', async () => {
    await addFirstStudySubject()
    await addFirstStudyEvent()
    await addFirstStudySession()

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Good morning' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Your first study loop' })).not.toBeInTheDocument()
  })

  it('opens checklist workflows with native keyboard actions and supported focus', async () => {
    const user = userEvent.setup()
    render(<App />)

    const createSubject = within(await screen.findByRole('region', { name: 'Your first study loop' })).getByRole('button', { name: 'Create subject' })
    createSubject.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByLabelText('Subject name')).toHaveFocus()

    await user.type(screen.getByLabelText('Subject name'), 'Physics')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(screen.getByRole('button', { name: 'Home' }))

    const planTask = screen.getByRole('button', { name: 'Plan task' })
    planTask.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByLabelText('Task title')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    const logSession = screen.getByRole('button', { name: 'Log session' })
    logSession.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('form', { name: 'Log study session' })).toBeInTheDocument()
    expect(screen.getByLabelText('Subject')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Log session' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Home' }))
    await user.click(screen.getByRole('button', { name: 'Progress' }))
    expect(screen.queryByRole('form', { name: 'Log study session' })).not.toBeInTheDocument()
  })

  it('focuses and clears global search with keyboard shortcuts', async () => {
    const user = userEvent.setup()
    render(<App />)

    const searchInput = await screen.findByPlaceholderText('Search')
    await user.keyboard('/')
    expect(searchInput).toHaveFocus()

    await user.type(searchInput, 'calculus')
    await user.keyboard('{Escape}')
    expect(searchInput).toHaveValue('')
    expect(searchInput).not.toHaveFocus()
  })

  it('adds, edits, completes, searches, and deletes a task', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    await user.click(screen.getByRole('button', { name: 'New task' }))
    await user.type(screen.getByLabelText('Task title'), 'Linear algebra drills')
    await user.clear(screen.getByLabelText('Minutes'))
    await user.type(screen.getByLabelText('Minutes'), '45')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Linear algebra drills')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Task created.')

    await user.click(screen.getByLabelText('Edit Linear algebra drills'))
    await user.clear(screen.getByLabelText('Task title'))
    await user.type(screen.getByLabelText('Task title'), 'Matrix practice')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Matrix practice')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Task updated.')

    await user.click(screen.getByLabelText('Toggle Matrix practice'))
    await waitFor(() => expect(screen.getByText('Matrix practice').closest('.list-row')).toHaveClass('is-done'))
    expect(await screen.findByRole('status')).toHaveTextContent('Task marked complete.')

    await user.type(screen.getByPlaceholderText('Search'), 'matrix')
    expect(screen.getByText('Matrix practice')).toBeInTheDocument()
    expect(screen.queryByText('Chemistry lab report')).not.toBeInTheDocument()

    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(screen.getByLabelText('Delete Matrix practice'))
    await waitFor(() => expect(screen.queryByText('Matrix practice')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent('Task deleted.')
    confirmDelete.mockRestore()
  })

  it('prevents duplicate task create while save is pending', async () => {
    const user = userEvent.setup()
    let releaseAdd!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseAdd = resolve
    })
    const originalAdd = studyDb.tasks.add.bind(studyDb.tasks)
    const addSpy = vi.spyOn(studyDb.tasks, 'add').mockImplementation(async (task) => {
      await gate
      return originalAdd(task)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    await user.click(screen.getByRole('button', { name: 'New task' }))
    await user.type(screen.getByLabelText('Task title'), 'Pending create task')
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.type(screen.getByLabelText('Due date'), '2026-07-22')
    await user.clear(screen.getByLabelText('Minutes'))
    await user.type(screen.getByLabelText('Minutes'), '40')

    await user.click(screen.getByRole('button', { name: 'Save' }))
    const savingButton = await screen.findByRole('button', { name: 'Creating task...' })
    expect(savingButton).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    await user.click(savingButton)
    expect(addSpy).toHaveBeenCalledTimes(1)

    releaseAdd()
    expect(await screen.findByText('Pending create task')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Task created.')
    expect(await studyDb.tasks.count()).toBe(1)
  })

  it('preserves task draft after a failed create and allows retry', async () => {
    const user = userEvent.setup()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const originalAdd = studyDb.tasks.add.bind(studyDb.tasks)
    const addSpy = vi.spyOn(studyDb.tasks, 'add')
      .mockRejectedValueOnce(new Error('IndexedDB write failed: constraint detail'))
      .mockImplementation(async (task) => originalAdd(task))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    await user.click(screen.getByRole('button', { name: 'New task' }))
    await user.type(screen.getByLabelText('Task title'), 'Retryable task')
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.type(screen.getByLabelText('Due date'), '2026-07-25')
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '55' } })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Task could not be saved. Your details are still in the form.')
    expect(screen.queryByText('IndexedDB')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Task title')).toHaveValue('Retryable task')
    expect(screen.getByLabelText('Task title')).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Priority')).toHaveValue('high')
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-07-25')
    expect(screen.getByLabelText('Minutes')).toHaveValue(55)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Retryable task')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Task created.')
    expect(await studyDb.tasks.count()).toBe(1)
    expect(addSpy).toHaveBeenCalledTimes(2)
    expect(consoleError).toHaveBeenCalled()
  })

  it('associates an empty task title validation error with the title field', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    await user.click(screen.getByRole('button', { name: 'New task' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const titleInput = screen.getByLabelText('Task title')
    const error = screen.getByRole('alert')
    expect(error).toHaveTextContent('Enter a task title.')
    expect(error).toHaveAttribute('id', 'task-title-error')
    expect(titleInput).toHaveAttribute('aria-invalid', 'true')
    expect(titleInput).toHaveAttribute('aria-describedby', 'task-title-error')
    expect(await studyDb.tasks.count()).toBe(0)

    await user.type(titleInput, 'Associated title task')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Associated title task')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(await studyDb.tasks.count()).toBe(1)
  })

  it('treats a missing-row edit as failure and keeps the editor open', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.tasks.add({
      id: 'task-missing-edit',
      title: 'Existing task',
      subjectId: '',
      dueDate: '2026-07-01',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(studyDb.tasks, 'update').mockResolvedValueOnce(0)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    await user.click(await screen.findByLabelText('Edit Existing task'))
    await user.clear(screen.getByLabelText('Task title'))
    await user.type(screen.getByLabelText('Task title'), 'Renamed missing task')
    await user.selectOptions(screen.getByLabelText('Priority'), 'low')
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '70' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Task could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Task title')).toHaveValue('Renamed missing task')
    expect(screen.getByLabelText('Priority')).toHaveValue('low')
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-07-01')
    expect(screen.getByLabelText('Minutes')).toHaveValue(70)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('blocks duplicate status toggles and preserves status when toggle fails', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.tasks.add({
      id: 'task-toggle-pending',
      title: 'Toggle race task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 20,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    let releaseUpdate!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseUpdate = resolve
    })
    const originalUpdate = studyDb.tasks.update.bind(studyDb.tasks)
    const updateSpy = vi.spyOn(studyDb.tasks, 'update').mockImplementation(async (id, changes) => {
      await gate
      return originalUpdate(id, changes)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    const toggle = await screen.findByLabelText('Toggle Toggle race task')
    await user.click(toggle)

    expect(await screen.findByLabelText('Updating Toggle race task')).toBeDisabled()
    expect(screen.getByLabelText('Edit Toggle race task')).toBeDisabled()
    await user.click(screen.getByLabelText('Updating Toggle race task'))
    expect(updateSpy).toHaveBeenCalledTimes(1)

    releaseUpdate()
    await waitFor(() => expect(screen.getByText('Toggle race task').closest('.list-row')).toHaveClass('is-done'))
    expect(await screen.findByRole('status')).toHaveTextContent('Task marked complete.')

    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    updateSpy.mockRejectedValueOnce(new Error('status write failed'))
    await user.click(screen.getByLabelText('Toggle Toggle race task'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Task could not be reopened.')
    expect(screen.getByText('Toggle race task').closest('.list-row')).toHaveClass('is-done')
  })

  it('keeps a task visible when deletion fails', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.tasks.add({
      id: 'task-delete-fail',
      title: 'Sticky task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 15,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const deleteSpy = vi.spyOn(studyDb.tasks, 'delete').mockRejectedValueOnce(new Error('delete failed'))
    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    await user.click(await screen.findByLabelText('Delete Sticky task'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Task could not be deleted. Please try again.')
    expect(screen.getByText('Sticky task')).toBeInTheDocument()
    expect(await studyDb.tasks.get('task-delete-fail')).toBeDefined()

    deleteSpy.mockRestore()
    await user.click(screen.getByLabelText('Delete Sticky task'))
    await waitFor(() => expect(screen.queryByText('Sticky task')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent('Task deleted.')
    confirmDelete.mockRestore()
  })

  it('opens new task and subject editors from the home hero', async () => {
    const user = userEvent.setup()
    render(<App />)

    const hero = await screen.findByLabelText('Today overview')
    await user.click(within(hero).getByRole('button', { name: 'Task' }))
    expect(await screen.findByLabelText('Task title')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    await user.click(within(screen.getByLabelText('Today overview')).getByRole('button', { name: 'Subject' }))
    expect(await screen.findByLabelText('Subject name')).toBeInTheDocument()
  })

  it('shows meaningful search results on Home', async () => {
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-search',
      name: 'Biology',
      color: '#0f766e',
      targetHours: 5,
      progress: 20,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })
    await studyDb.tasks.add({
      id: 'task-search',
      title: 'Cell cycle worksheet',
      subjectId: 'subject-search',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })

    render(<App />)

    await user.type(await screen.findByPlaceholderText('Search'), 'cell')

    expect(await screen.findByRole('heading', { name: 'Search Results' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Task: Cell cycle worksheet, Biology - open' })).toBeInTheDocument()
  })

  it('logs focus sessions with the selected subject', async () => {
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-focus',
      name: 'Physics',
      color: '#2563eb',
      targetHours: 6,
      progress: 10,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })

    render(<App />)

    await user.selectOptions(await screen.findByLabelText('Focus subject'), 'subject-focus')
    expect(screen.getByLabelText('Session length')).toHaveValue('25')
    await waitForFocusStartEnabled()
    await user.click(screen.getByRole('button', { name: 'Start focus' }))
    expect(await screen.findByText('Elapsed')).toBeInTheDocument()
    expect(await getActiveFocusSession()).toMatchObject({ subjectId: 'subject-focus', plannedMinutes: 25 })
    await user.click(screen.getByRole('button', { name: 'Stop session' }))

    await waitFor(async () => {
      const sessions = await studyDb.studySessions.toArray()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].subjectId).toBe('subject-focus')
    })
    expect(await getActiveFocusSession()).toBeNull()
  })

  it('blocks deleting subjects that still have linked records', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm')
    const deleteSpy = vi.spyOn(studyDb.subjects, 'delete')
    await studyDb.subjects.add({
      id: 'subject-linked',
      name: 'Chemistry',
      color: '#b45309',
      targetHours: 4,
      progress: 0,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })
    await studyDb.notes.add({
      id: 'note-linked',
      title: 'Periodic trends',
      body: 'Reactivity notes',
      subjectId: 'subject-linked',
      tags: [],
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })

    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Subjects' }))
    await user.click(screen.getByLabelText('Delete Chemistry'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Cannot delete Chemistry/)
    expect(await screen.findByRole('alert')).toHaveTextContent(/1 notes/)
    expect(confirm).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(await studyDb.subjects.get('subject-linked')).toBeDefined()
    expect(screen.getByLabelText('Delete Chemistry')).toBeEnabled()
  })

  it('implements profile and progress log-session controls', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Profile' }))
    const notices = await screen.findAllByText(/Profile settings live in this local/i)
    expect(notices.length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Progress' }))
    const logSessionButton = screen.getByRole('button', { name: 'Log session' })
    await user.click(logSessionButton)
    expect(await screen.findByRole('heading', { name: 'Log study session' })).toBeInTheDocument()
    expect(screen.getByLabelText('Subject')).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Stop session' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('heading', { name: 'Log study session' })).not.toBeInTheDocument()
    expect(logSessionButton).toHaveFocus()
  })

  it('creates, edits, and deletes journal sessions while updating derived progress', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))
    const user = userEvent.setup()
    const timestamp = new Date().toISOString()
    await studyDb.subjects.add({
      id: 'subject-journal',
      name: 'Physics',
      color: '#2563eb',
      targetHours: 1,
      progress: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await studyDb.goals.add({
      id: 'goal-journal',
      title: 'Daily focus',
      target: 60,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    const start = new Date(2026, 6, 13, 13, 0)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    await user.click(screen.getByRole('button', { name: 'Log session' }))
    await user.selectOptions(screen.getByLabelText('Subject'), 'subject-journal')
    await user.clear(screen.getByLabelText('Date'))
    await user.type(screen.getByLabelText('Date'), toInputDate(start))
    await user.clear(screen.getByLabelText('Start time'))
    await user.type(screen.getByLabelText('Start time'), toInputTime(start))
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '30')
    await user.type(screen.getByLabelText('Note Optional'), 'Worked through momentum problems')
    await user.click(screen.getByRole('button', { name: 'Save session' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Study session recorded.')
    const journal = screen.getByRole('region', { name: 'Study journal' })
    expect(within(journal).getByLabelText(/Physics, .*30m/)).toBeInTheDocument()
    expect(within(journal).getByText('Worked through momentum problems')).toBeInTheDocument()
    expect(within(screen.getByText('Weekly study').closest('article')! as HTMLElement).getByText('0h 30m')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(within(screen.getByLabelText('Today overview')).getByText('30m')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Subjects' }))
    expect(screen.getByRole('progressbar', { name: '50%' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Goals' }))
    expect(screen.getByText('30/60 minutes')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '50%' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Progress' }))
    const editSessionButton = screen.getByLabelText(/Edit Physics session at/)
    await user.click(editSessionButton)
    expect(screen.getByLabelText('Subject')).toHaveFocus()
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '35')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(editSessionButton).toHaveFocus()
    expect((await studyDb.studySessions.toArray())[0].minutes).toBe(30)

    await user.click(editSessionButton)
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '45')
    await user.clear(screen.getByLabelText('Note Optional'))
    await user.type(screen.getByLabelText('Note Optional'), 'Momentum and force review')
    await user.click(screen.getByRole('button', { name: 'Update session' }))

    await waitFor(async () => expect((await studyDb.studySessions.toArray())[0]).toMatchObject({ minutes: 45, note: 'Momentum and force review' }))
    await waitFor(() => expect(screen.getByLabelText(/Physics, .*45m/)).toBeInTheDocument())
    expect(editSessionButton).toHaveFocus()

    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    await user.click(screen.getByLabelText(/Delete Physics session at/))
    expect(await studyDb.studySessions.count()).toBe(1)
    await user.click(screen.getByLabelText(/Delete Physics session at/))
    await waitFor(() => expect(screen.queryByLabelText(/Physics, .*45m/)).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Study session deleted.')
    expect(confirmDelete).toHaveBeenCalledWith(`Delete session from ${formatShortTime(start.toISOString())}? This cannot be undone.`)

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(within(screen.getByLabelText('Today overview')).getByText('0m')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Goals' }))
    expect(screen.getByText('0/60 minutes')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '0%' })).toBeInTheDocument()
  }, 15_000)

  it('groups cross-midnight sessions by local start date while crediting metrics on their local end date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 0, 30))
    const user = userEvent.setup()

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    await user.click(screen.getByRole('button', { name: 'Log session' }))
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-12' } })
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '23:45' } })
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '25')
    await user.click(screen.getByRole('button', { name: 'Save session' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Study session recorded.')
    const journal = screen.getByRole('region', { name: 'Study journal' })
    expect(within(journal).getByRole('region', { name: 'Yesterday' })).toBeInTheDocument()
    expect(within(journal).getByLabelText(/General, .*25m/)).toBeInTheDocument()
    expect(within(screen.getByText('Weekly study').closest('article')! as HTMLElement).getByText('0h 25m')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(within(screen.getByLabelText('Today overview')).getByText('25m')).toBeInTheDocument()
  })

  it('validates manual session fields and rejects future end times', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))
    await studyDb.studySessions.add({
      id: 'session-needs-subject',
      subjectId: 'missing-subject',
      startedAt: new Date(2026, 6, 13, 14, 0).toISOString(),
      endedAt: new Date(2026, 6, 13, 14, 30).toISOString(),
      minutes: 30,
      note: '',
    })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    await user.click(screen.getByLabelText(/Edit Missing subject session at/))
    await user.click(screen.getByRole('button', { name: 'Update session' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Choose an available subject or General.')
    expect(screen.getByLabelText('Subject')).toHaveFocus()

    await user.selectOptions(screen.getByLabelText('Subject'), '')
    await user.click(screen.getByRole('button', { name: 'Update session' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Study session updated.')
    expect((await studyDb.studySessions.toArray())[0].subjectId).toBe('')

    await user.click(screen.getByRole('button', { name: 'Log session' }))
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '0')
    await user.click(screen.getByRole('button', { name: 'Save session' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Duration must be at least 1 minute.')
    expect(screen.getByLabelText('Duration (minutes)')).toHaveFocus()

    await user.clear(screen.getByLabelText('Date'))
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '30')
    await user.click(screen.getByRole('button', { name: 'Save session' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid date and start time.')
    expect(screen.getByLabelText('Date')).toHaveFocus()

    const now = new Date()
    await user.type(screen.getByLabelText('Date'), toInputDate(now))
    await user.clear(screen.getByLabelText('Start time'))
    await user.type(screen.getByLabelText('Start time'), toInputTime(now))
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '1')
    await user.click(screen.getByRole('button', { name: 'Save session' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Session end time cannot be in the future.')
    expect(screen.getByLabelText('Duration (minutes)')).toHaveFocus()
    expect((await studyDb.studySessions.toArray()).map((session) => session.id)).toEqual(['session-needs-subject'])
  })

  it('does not invoke Dexie when manual session validation fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))
    const user = userEvent.setup()
    const addSpy = vi.spyOn(studyDb.studySessions, 'add')
    const updateSpy = vi.spyOn(studyDb.studySessions, 'update')

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    await user.click(screen.getByRole('button', { name: 'Log session' }))
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '0')
    await user.click(screen.getByRole('button', { name: 'Save session' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Duration must be at least 1 minute.')
    expect(addSpy).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('prevents duplicate session create while save is pending', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))
    const user = userEvent.setup()
    let releaseAdd!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseAdd = resolve
    })
    const originalAdd = studyDb.studySessions.add.bind(studyDb.studySessions)
    const addSpy = vi.spyOn(studyDb.studySessions, 'add').mockImplementation(async (session) => {
      await gate
      return originalAdd(session)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    await user.click(screen.getByRole('button', { name: 'Log session' }))
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-13' } })
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '14:00' } })
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '25')
    await user.click(screen.getByRole('button', { name: 'Save session' }))

    const savingButton = await screen.findByRole('button', { name: 'Recording session...' })
    expect(savingButton).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByLabelText('Subject')).toBeDisabled()
    await user.click(savingButton)
    expect(addSpy).toHaveBeenCalledTimes(1)

    releaseAdd()
    expect(await screen.findByRole('status')).toHaveTextContent('Study session recorded.')
    expect(await studyDb.studySessions.count()).toBe(1)
  })

  it('preserves session draft after a failed create and allows retry', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const originalAdd = studyDb.studySessions.add.bind(studyDb.studySessions)
    const addSpy = vi.spyOn(studyDb.studySessions, 'add')
      .mockRejectedValueOnce(new Error('IndexedDB session write failed'))
      .mockImplementation(async (session) => originalAdd(session))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    await user.click(screen.getByRole('button', { name: 'Log session' }))
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-13' } })
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '13:15' } })
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '40')
    await user.type(screen.getByLabelText('Note Optional'), 'Retry note')
    await user.click(screen.getByRole('button', { name: 'Save session' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Study session could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-07-13')
    expect(screen.getByLabelText('Start time')).toHaveValue('13:15')
    expect(screen.getByLabelText('Duration (minutes)')).toHaveValue(40)
    expect(screen.getByLabelText('Note Optional')).toHaveValue('Retry note')
    expect(screen.getByRole('button', { name: 'Save session' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Save session' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Study session recorded.')
    expect(addSpy).toHaveBeenCalledTimes(2)
    expect((await studyDb.studySessions.toArray())[0]).toMatchObject({
      minutes: 40,
      note: 'Retry note',
    })
  })

  it('treats a missing-row session edit as failure and keeps the editor open', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))
    const user = userEvent.setup()
    await studyDb.studySessions.add({
      id: 'session-missing-edit',
      subjectId: '',
      startedAt: new Date(2026, 6, 13, 12, 0).toISOString(),
      endedAt: new Date(2026, 6, 13, 12, 30).toISOString(),
      minutes: 30,
      note: 'Original note',
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(studyDb.studySessions, 'update').mockResolvedValueOnce(0)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    await user.click(screen.getByLabelText(/Edit General session at/))
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '55')
    await user.clear(screen.getByLabelText('Note Optional'))
    await user.type(screen.getByLabelText('Note Optional'), 'Edited note')
    await user.click(screen.getByRole('button', { name: 'Update session' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Study session could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Duration (minutes)')).toHaveValue(55)
    expect(screen.getByLabelText('Note Optional')).toHaveValue('Edited note')
    expect(screen.getByRole('heading', { name: 'Edit study session' })).toBeInTheDocument()
  })

  it('keeps a session visible when confirmed deletion fails and blocks duplicate deletes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))
    const user = userEvent.setup()
    const timestamp = new Date().toISOString()
    await studyDb.goals.add({
      id: 'goal-session-delete',
      title: 'Daily focus',
      target: 60,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await studyDb.studySessions.add({
      id: 'session-delete-fail',
      subjectId: '',
      startedAt: new Date(2026, 6, 13, 13, 0).toISOString(),
      endedAt: new Date(2026, 6, 13, 13, 30).toISOString(),
      minutes: 30,
      note: 'Sticky session',
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    let releaseDelete!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseDelete = resolve
    })
    const originalDelete = studyDb.studySessions.delete.bind(studyDb.studySessions)
    const deleteSpy = vi.spyOn(studyDb.studySessions, 'delete').mockImplementation(async () => {
      await gate
      throw new Error('delete failed')
    })
    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    expect(within(screen.getByText('Weekly study').closest('article')! as HTMLElement).getByText('0h 30m')).toBeInTheDocument()
    await user.click(screen.getByLabelText(/Delete General session at/))

    expect(await screen.findByLabelText(/Deleting General session at/)).toBeDisabled()
    expect(screen.getByLabelText(/Edit General session at/)).toBeDisabled()
    await user.click(screen.getByLabelText(/Deleting General session at/))
    expect(deleteSpy).toHaveBeenCalledTimes(1)

    releaseDelete()
    expect(await screen.findByRole('alert')).toHaveTextContent('Study session could not be deleted. Please try again.')
    expect(screen.getByText('Sticky session')).toBeInTheDocument()
    expect(within(screen.getByText('Weekly study').closest('article')! as HTMLElement).getByText('0h 30m')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Goals' }))
    expect(screen.getByText('30/60 minutes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Progress' }))
    deleteSpy.mockImplementation(async (id) => originalDelete(id))
    await user.click(screen.getByLabelText(/Delete General session at/))
    await waitFor(() => expect(screen.queryByText('Sticky session')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent('Study session deleted.')
    expect(within(screen.getByText('Weekly study').closest('article')! as HTMLElement).getByText('0h')).toBeInTheDocument()
    confirmDelete.mockRestore()
  })

  it('labels sessions whose subject no longer exists', async () => {
    const now = new Date()
    const startedAt = new Date(now.getTime() - 30 * 60_000)
    await studyDb.studySessions.add({
      id: 'session-missing-subject',
      subjectId: 'deleted-subject',
      startedAt: startedAt.toISOString(),
      endedAt: now.toISOString(),
      minutes: 30,
      note: 'Imported study record',
    })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    expect(screen.getByText('Missing subject')).toHaveClass('is-missing')
    expect(screen.getByText('Imported study record')).toBeInTheDocument()
  })

  it('toggles dark mode from settings', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('radio', { name: /Midnight/ }))

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it.each(THEME_CASES)('restores the saved %s theme preference', async (theme, themeColor) => {
    localStorage.setItem('study-dashboard-theme', theme)
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Good morning' })).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe(theme)
    expect(localStorage.getItem('study-dashboard-theme')).toBe(theme)
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', themeColor)
  })

  it('falls back to Monochrome when a saved theme preference is invalid', async () => {
    localStorage.setItem('study-dashboard-theme', 'unknown-theme')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Good morning' })).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('monochrome')
    expect(localStorage.getItem('study-dashboard-theme')).toBe('monochrome')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#111111')
  })

  it('collapses and expands the desktop sidebar', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Collapse sidebar' }))
    expect(document.querySelector('.app-shell')).toHaveClass('is-sidebar-collapsed')

    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(document.querySelector('.app-shell')).not.toHaveClass('is-sidebar-collapsed')
  })

  it('supports all seven theme choices and updates new theme metadata', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    const themeGroup = screen.getByRole('radiogroup', { name: 'Theme' })
    expect(within(themeGroup).getAllByRole('radio')).toHaveLength(7)
    const monochromeOption = within(themeGroup).getByRole('radio', { name: /Monochrome/ })
    const canvasOption = within(themeGroup).getByRole('radio', { name: /Canvas/ })
    const emberOption = within(themeGroup).getByRole('radio', { name: /Ember/ })
    expect(monochromeOption).toHaveAttribute('aria-checked', 'true')
    expect(monochromeOption).toHaveAttribute('tabindex', '0')
    expect(canvasOption).toHaveAttribute('tabindex', '-1')

    monochromeOption.focus()
    await user.keyboard('{ArrowRight}')
    expect(canvasOption).toHaveFocus()
    expect(canvasOption).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{End}')
    expect(emberOption).toHaveFocus()
    expect(emberOption).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{Home}')
    expect(monochromeOption).toHaveFocus()
    expect(monochromeOption).toHaveAttribute('aria-checked', 'true')

    for (const [label, theme, themeColor] of [
      ['Blueprint', 'blueprint', '#153f73'],
      ['Moss Library', 'moss', '#294633'],
      ['Monochrome', 'monochrome', '#111111'],
    ] as const) {
      const option = within(themeGroup).getByRole('radio', { name: new RegExp(label) })
      await user.click(option)
      expect(option).toHaveAttribute('aria-checked', 'true')
      expect(document.documentElement.dataset.theme).toBe(theme)
      expect(localStorage.getItem('study-dashboard-theme')).toBe(theme)
      expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', themeColor)
    }
  })

  it('creates and opens a note', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Notes' }))
    await user.click(screen.getByRole('button', { name: 'New note' }))
    await user.type(screen.getByLabelText('Note title'), 'Exam checklist')
    await user.type(screen.getByLabelText('Body'), 'Past papers, formulas, and weak areas.')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const newNote = (await screen.findByText('Exam checklist')).closest('.detail-card')
    expect(newNote).not.toBeNull()
    expect(within(newNote as HTMLElement).getByText('Past papers, formulas, and weak areas.')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Note created.')
  })

  it('prevents duplicate note create while save is pending', async () => {
    const user = userEvent.setup()
    let releaseAdd!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseAdd = resolve
    })
    const originalAdd = studyDb.notes.add.bind(studyDb.notes)
    const addSpy = vi.spyOn(studyDb.notes, 'add').mockImplementation(async (note) => {
      await gate
      return originalAdd(note)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Notes' }))
    await user.click(screen.getByRole('button', { name: 'New note' }))
    await user.type(screen.getByLabelText('Note title'), 'Pending note')
    await user.type(screen.getByLabelText('Body'), 'Body while pending')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const savingButton = await screen.findByRole('button', { name: 'Creating note...' })
    expect(savingButton).toBeDisabled()
    await user.click(savingButton)
    expect(addSpy).toHaveBeenCalledTimes(1)

    releaseAdd()
    expect(await screen.findByText('Pending note')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Note created.')
    expect(await studyDb.notes.count()).toBe(1)
  })

  it('preserves note draft after a failed create and allows retry', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const originalAdd = studyDb.notes.add.bind(studyDb.notes)
    const addSpy = vi.spyOn(studyDb.notes, 'add')
      .mockRejectedValueOnce(new Error('IndexedDB note write failed'))
      .mockImplementation(async (note) => originalAdd(note))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Notes' }))
    await user.click(screen.getByRole('button', { name: 'New note' }))
    await user.type(screen.getByLabelText('Note title'), 'Retry note')
    await user.type(screen.getByLabelText('Tags'), 'exam, formulas')
    await user.type(
      screen.getByLabelText('Body'),
      'A long note body that must survive persistence failure without truncation or reset.',
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Note could not be saved. Your text is still available.')
    expect(screen.queryByText('IndexedDB')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Note title')).toHaveValue('Retry note')
    expect(screen.getByLabelText('Tags')).toHaveValue('exam, formulas')
    expect(screen.getByLabelText('Body')).toHaveValue(
      'A long note body that must survive persistence failure without truncation or reset.',
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Retry note')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Note created.')
    expect(await studyDb.notes.count()).toBe(1)
    expect(addSpy).toHaveBeenCalledTimes(2)
  })

  it('treats a missing-row note edit as failure and keeps the editor open', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.notes.add({
      id: 'note-missing-edit',
      title: 'Existing note',
      body: 'Original body',
      subjectId: '',
      tags: ['review'],
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(studyDb.notes, 'update').mockResolvedValueOnce(0)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Notes' }))
    await user.click(await screen.findByLabelText('Edit Existing note'))
    await user.clear(screen.getByLabelText('Note title'))
    await user.type(screen.getByLabelText('Note title'), 'Edited missing note')
    await user.clear(screen.getByLabelText('Tags'))
    await user.type(screen.getByLabelText('Tags'), 'edited, tags')
    await user.clear(screen.getByLabelText('Body'))
    await user.type(screen.getByLabelText('Body'), 'Edited body text')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Note could not be saved. Your text is still available.')
    expect(screen.getByLabelText('Note title')).toHaveValue('Edited missing note')
    expect(screen.getByLabelText('Tags')).toHaveValue('edited, tags')
    expect(screen.getByLabelText('Body')).toHaveValue('Edited body text')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('keeps a note visible when deletion fails and blocks duplicate deletes', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.notes.add({
      id: 'note-delete-fail',
      title: 'Sticky note',
      body: 'Keep me',
      subjectId: '',
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    let releaseDelete!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseDelete = resolve
    })
    const originalDelete = studyDb.notes.delete.bind(studyDb.notes)
    const deleteSpy = vi.spyOn(studyDb.notes, 'delete').mockImplementation(async () => {
      await gate
      throw new Error('delete failed')
    })
    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Notes' }))
    await user.click(await screen.findByLabelText('Delete Sticky note'))

    expect(await screen.findByLabelText('Deleting Sticky note')).toBeDisabled()
    expect(screen.getByLabelText('Edit Sticky note')).toBeDisabled()
    await user.click(screen.getByLabelText('Deleting Sticky note'))
    expect(deleteSpy).toHaveBeenCalledTimes(1)

    releaseDelete()
    expect(await screen.findByRole('alert')).toHaveTextContent('Note could not be deleted.')
    expect(screen.getByText('Sticky note')).toBeInTheDocument()
    expect(await studyDb.notes.get('note-delete-fail')).toBeDefined()

    deleteSpy.mockImplementation(async (id) => originalDelete(id))
    await user.click(screen.getByLabelText('Delete Sticky note'))
    await waitFor(() => expect(screen.queryByText('Sticky note')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent('Note deleted.')
    confirmDelete.mockRestore()
  })

  it('creates a flashcard and marks it remembered', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Flashcards' }))
    await user.click(screen.getByRole('button', { name: 'New card' }))
    await user.type(screen.getByLabelText('Front'), 'Derivative rule')
    await user.type(screen.getByLabelText('Back'), 'Power rule')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Derivative rule')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Flashcard created.')
    expect(screen.getByText('Answer hidden')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(screen.getByText('Power rule')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remembered' }))
    expect(await screen.findByText('remembered')).toBeInTheDocument()
    expect(await screen.findByText(/Next review/)).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Flashcard marked remembered.')
  })

  it('preserves flashcard draft after a failed create', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const originalAdd = studyDb.flashcards.add.bind(studyDb.flashcards)
    vi.spyOn(studyDb.flashcards, 'add')
      .mockRejectedValueOnce(new Error('IndexedDB card write failed'))
      .mockImplementation(async (card) => originalAdd(card))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Flashcards' }))
    await user.click(screen.getByRole('button', { name: 'New card' }))
    await user.type(screen.getByLabelText('Front'), 'Retry front')
    await user.type(screen.getByLabelText('Back'), 'Retry back')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Flashcard could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Front')).toHaveValue('Retry front')
    expect(screen.getByLabelText('Back')).toHaveValue('Retry back')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Retry front')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Flashcard created.')
    expect(await studyDb.flashcards.count()).toBe(1)
  })

  it('treats a missing-row flashcard edit as failure and keeps values', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.flashcards.add({
      id: 'card-missing-edit',
      front: 'Existing front',
      back: 'Existing back',
      subjectId: '',
      status: 'new',
      lastReviewedAt: '',
      dueAt: timestamp,
      intervalDays: 0,
      reviewCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(studyDb.flashcards, 'update').mockResolvedValueOnce(0)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Flashcards' }))
    await user.click(await screen.findByLabelText('Edit Existing front'))
    await user.clear(screen.getByLabelText('Front'))
    await user.type(screen.getByLabelText('Front'), 'Edited front')
    await user.clear(screen.getByLabelText('Back'))
    await user.type(screen.getByLabelText('Back'), 'Edited back')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Flashcard could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Front')).toHaveValue('Edited front')
    expect(screen.getByLabelText('Back')).toHaveValue('Edited back')
  })

  it('blocks duplicate flashcard review and preserves the card when review fails', async () => {
    const user = userEvent.setup()
    const timestamp = new Date().toISOString()
    await studyDb.flashcards.add({
      id: 'card-review-pending',
      front: 'Review race card',
      back: 'Answer',
      subjectId: '',
      status: 'new',
      lastReviewedAt: '',
      dueAt: timestamp,
      intervalDays: 0,
      reviewCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    let releaseUpdate!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseUpdate = resolve
    })
    const originalUpdate = studyDb.flashcards.update.bind(studyDb.flashcards)
    const updateSpy = vi.spyOn(studyDb.flashcards, 'update').mockImplementation(async (id, changes) => {
      await gate
      return originalUpdate(id, changes)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Flashcards' }))
    await user.click(await screen.findByRole('button', { name: 'Remembered' }))

    const savingButtons = await screen.findAllByRole('button', { name: 'Saving review...' })
    expect(savingButtons).toHaveLength(2)
    savingButtons.forEach((button) => expect(button).toBeDisabled())
    expect(screen.getByLabelText('Edit Review race card')).toBeDisabled()
    await user.click(savingButtons[0])
    expect(updateSpy).toHaveBeenCalledTimes(1)

    releaseUpdate()
    expect(await screen.findByRole('status')).toHaveTextContent('Flashcard marked remembered.')
    expect(await screen.findByText('remembered')).toBeInTheDocument()

    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    updateSpy.mockRejectedValueOnce(new Error('review write failed'))
    await user.click(screen.getByRole('button', { name: 'Later' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Review could not be saved. The card has not been advanced.')
    expect(screen.getByText('Review race card')).toBeInTheDocument()
    expect(screen.getByText('remembered')).toBeInTheDocument()
  })

  it('keeps a flashcard visible when deletion fails and blocks duplicate deletes', async () => {
    const user = userEvent.setup()
    const timestamp = new Date().toISOString()
    await studyDb.flashcards.add({
      id: 'card-delete-fail',
      front: 'Sticky card',
      back: 'Keep me',
      subjectId: '',
      status: 'new',
      lastReviewedAt: '',
      dueAt: timestamp,
      intervalDays: 0,
      reviewCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    let releaseDelete!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseDelete = resolve
    })
    const originalDelete = studyDb.flashcards.delete.bind(studyDb.flashcards)
    const deleteSpy = vi.spyOn(studyDb.flashcards, 'delete').mockImplementation(async () => {
      await gate
      throw new Error('delete failed')
    })
    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Flashcards' }))
    await user.click(await screen.findByLabelText('Delete Sticky card'))

    expect(await screen.findByLabelText('Deleting Sticky card')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remembered' })).toBeDisabled()
    await user.click(screen.getByLabelText('Deleting Sticky card'))
    expect(deleteSpy).toHaveBeenCalledTimes(1)

    releaseDelete()
    expect(await screen.findByRole('alert')).toHaveTextContent('Flashcard could not be deleted.')
    expect(screen.getByText('Sticky card')).toBeInTheDocument()

    deleteSpy.mockImplementation(async (id) => originalDelete(id))
    await user.click(screen.getByLabelText('Delete Sticky card'))
    await waitFor(() => expect(screen.queryByText('Sticky card')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent('Flashcard deleted.')
    confirmDelete.mockRestore()
  })

  it('confirms before clearing all study data and reports success', async () => {
    const user = userEvent.setup()

    await studyDb.tasks.add({
      id: 'task-clear-test',
      title: 'Keep until confirmed',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })
    await studyDb.settings.put({ key: 'quickNotes', value: ['Important quick note'] })

    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    const resetBtn = screen.getByRole('button', { name: /Reset all study data/ })
    await user.click(resetBtn)

    // Check Cancel flow
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    await user.click(cancelBtn)

    await user.click(screen.getByRole('button', { name: 'Tasks' }))
    expect(await screen.findByText('Keep until confirmed')).toBeInTheDocument()

    // Now confirm deletion
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: /Reset all study data/ }))

    const confirmInput = screen.getByPlaceholderText('DELETE')
    const deleteBtn = screen.getByRole('button', { name: 'Delete all data' })

    expect(deleteBtn).toBeDisabled()
    await user.type(confirmInput, 'DELETE')
    expect(deleteBtn).not.toBeDisabled()

    await user.click(deleteBtn)

    // Verify success message and redirection to Home (empty state)
    expect(await screen.findByRole('status', { name: '' })).toHaveTextContent('All study data has been permanently deleted.')
    expect(await screen.findByRole('heading', { name: 'Good morning' })).toBeInTheDocument()

    // Quick notes should be gone
    const quickNotesData = await studyDb.settings.get('quickNotes')
    expect(quickNotesData).toBeUndefined()

    await user.click(screen.getByRole('button', { name: 'Tasks' }))
    await waitFor(() => expect(screen.queryByText('Keep until confirmed')).not.toBeInTheDocument())
  })

  it('handles deletion errors safely', async () => {
    const user = userEvent.setup()

    // Mock the error
    const spy = vi.spyOn(studyDb.tasks, 'clear').mockRejectedValue(new Error('Simulated error'))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: /Reset all study data/ }))

    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
    await user.click(screen.getByRole('button', { name: 'Delete all data' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Study data could not be cleared. Please try again.')
    expect(screen.getByPlaceholderText('DELETE')).toHaveValue('DELETE')
    expect(screen.getByRole('button', { name: 'Delete all data' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()

    spy.mockRestore()
  })

  it('creates and displays calendar events', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Calendar' }))
    await user.click(screen.getByRole('button', { name: 'New event' }))
    await user.type(screen.getByLabelText('Event title'), 'Study group meeting')
    await user.type(screen.getByLabelText('Location'), 'Library room 3')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const events = await studyDb.events.toArray()
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Study group meeting')
    expect(events[0].location).toBe('Library room 3')

    await waitFor(() => expect(screen.getAllByText('Study group meeting').length).toBeGreaterThanOrEqual(1))
    expect(await screen.findByRole('status')).toHaveTextContent('Event created.')
  })

  it('validates calendar date and time before calling Dexie', async () => {
    const user = userEvent.setup()
    const addSpy = vi.spyOn(studyDb.events, 'add')

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Calendar' }))
    await user.click(screen.getByRole('button', { name: 'New event' }))
    await user.type(screen.getByLabelText('Event title'), 'Broken schedule')
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid date and start time.')
    expect(addSpy).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Event title')).toHaveValue('Broken schedule')
    expect(screen.getByLabelText('Date')).toHaveValue('')
    expect(screen.getByLabelText('Time')).toHaveValue('')
  })

  it('preserves calendar draft after a failed create and allows retry', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const originalAdd = studyDb.events.add.bind(studyDb.events)
    const addSpy = vi.spyOn(studyDb.events, 'add')
      .mockRejectedValueOnce(new Error('IndexedDB event write failed'))
      .mockImplementation(async (event) => originalAdd(event))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Calendar' }))
    await user.click(screen.getByRole('button', { name: 'New event' }))
    await user.type(screen.getByLabelText('Event title'), 'Retry event')
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '14:30' } })
    fireEvent.change(screen.getByLabelText('Duration'), { target: { value: '90' } })
    await user.type(screen.getByLabelText('Location'), 'Room 12')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Event could not be saved. Check the details and try again.')
    expect(screen.queryByText('IndexedDB')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Event title')).toHaveValue('Retry event')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-08-01')
    expect(screen.getByLabelText('Time')).toHaveValue('14:30')
    expect(screen.getByLabelText('Duration')).toHaveValue(90)
    expect(screen.getByLabelText('Location')).toHaveValue('Room 12')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Event created.')
    expect(screen.queryByLabelText('Event title')).not.toBeInTheDocument()
    expect(await studyDb.events.count()).toBe(1)
    expect(addSpy).toHaveBeenCalledTimes(2)
  })

  it('treats a missing-row calendar edit as failure and keeps values', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.events.add({
      id: 'event-missing-edit',
      title: 'Existing event',
      subjectId: '',
      startAt: '2026-08-02T10:00:00.000Z',
      endAt: '2026-08-02T11:00:00.000Z',
      location: 'Hall A',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(studyDb.events, 'update').mockResolvedValueOnce(0)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Calendar' }))
    await user.click(await screen.findByLabelText('Edit Existing event'))
    await user.clear(screen.getByLabelText('Event title'))
    await user.type(screen.getByLabelText('Event title'), 'Edited missing event')
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-03' } })
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '16:15' } })
    fireEvent.change(screen.getByLabelText('Duration'), { target: { value: '45' } })
    await user.clear(screen.getByLabelText('Location'))
    await user.type(screen.getByLabelText('Location'), 'Hall B')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Event could not be saved. Check the details and try again.')
    expect(screen.getByLabelText('Event title')).toHaveValue('Edited missing event')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-08-03')
    expect(screen.getByLabelText('Time')).toHaveValue('16:15')
    expect(screen.getByLabelText('Duration')).toHaveValue(45)
    expect(screen.getByLabelText('Location')).toHaveValue('Hall B')
  })

  it('keeps a calendar event visible when deletion fails and blocks duplicate deletes', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.events.add({
      id: 'event-delete-fail',
      title: 'Sticky event',
      subjectId: '',
      startAt: '2026-08-04T09:00:00.000Z',
      endAt: '2026-08-04T10:00:00.000Z',
      location: 'Lab',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    let releaseDelete!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseDelete = resolve
    })
    const originalDelete = studyDb.events.delete.bind(studyDb.events)
    const deleteSpy = vi.spyOn(studyDb.events, 'delete').mockImplementation(async () => {
      await gate
      throw new Error('delete failed')
    })
    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Calendar' }))
    await user.click(await screen.findByLabelText('Delete Sticky event'))

    expect(await screen.findByLabelText('Deleting Sticky event')).toBeDisabled()
    expect(screen.getByLabelText('Edit Sticky event')).toBeDisabled()
    await user.click(screen.getByLabelText('Deleting Sticky event'))
    expect(deleteSpy).toHaveBeenCalledTimes(1)

    releaseDelete()
    expect(await screen.findByRole('alert')).toHaveTextContent('Event could not be deleted. Please try again.')
    expect(screen.getByText('Sticky event')).toBeInTheDocument()
    expect(screen.getByLabelText('Seven day calendar')).toBeInTheDocument()
    expect(await studyDb.events.get('event-delete-fail')).toBeDefined()

    deleteSpy.mockImplementation(async (id) => originalDelete(id))
    await user.click(screen.getByLabelText('Delete Sticky event'))
    await waitFor(() => expect(screen.queryByText('Sticky event')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent('Event deleted.')
    confirmDelete.mockRestore()
  })

  it('creates and manages goals', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Study 2 hours daily')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Study 2 hours daily')).toBeInTheDocument()
    expect(screen.getByText('Manual progress')).toBeInTheDocument()

    const goals = await studyDb.goals.toArray()
    expect(goals).toHaveLength(1)
    expect(goals[0].title).toBe('Study 2 hours daily')
    expect(goals[0].metric).toBe('manual')
  })

  it('supports explicit goal metrics in the editor and cards', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))
    const user = userEvent.setup()
    const timestamp = new Date().toISOString()
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 120 })
    await studyDb.studySessions.add({
      id: 'session-goal-ui',
      subjectId: '',
      startedAt: new Date(2026, 6, 13, 10, 0).toISOString(),
      endedAt: new Date(2026, 6, 13, 10, 45).toISOString(),
      minutes: 45,
      note: '',
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))

    await user.click(screen.getByRole('button', { name: 'New goal' }))
    expect(screen.getByLabelText('Metric')).toHaveValue('manual')
    expect(screen.getByText('Update this goal yourself.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Goal title'), 'Study every day')
    await user.clear(screen.getByLabelText(/Target \(points\)/))
    await user.type(screen.getByLabelText(/Target \(points\)/), '90')
    await user.clear(screen.getByLabelText('Progress (points)'))
    await user.type(screen.getByLabelText('Progress (points)'), '12')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      expect((await studyDb.goals.toArray()).some((goal) => goal.title === 'Study every day')).toBe(true)
    })
    const manualCard = (await screen.findByText('Study every day')).closest('article') as HTMLElement
    expect(within(manualCard).getByText('Manual progress')).toBeInTheDocument()
    expect(within(manualCard).getByText('Daily')).toBeInTheDocument()
    expect(within(manualCard).getByText('12/90 points')).toBeInTheDocument()
    expect((await studyDb.goals.toArray()).find((goal) => goal.title === 'Study every day')).toMatchObject({
      metric: 'manual',
      progress: 12,
      target: 90,
    })
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(120)

    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Weekly target')
    await user.selectOptions(screen.getByLabelText('Metric'), 'study_time')
    expect(screen.getByText('Calculated automatically from recorded study sessions.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Progress (points)')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Period'), 'weekly')
    expect(screen.getByLabelText(/Target \(hours\)/)).toBeInTheDocument()
    await user.clear(screen.getByLabelText(/Target \(hours\)/))
    await user.type(screen.getByLabelText(/Target \(hours\)/), '5')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const studyCard = (await screen.findByText('Weekly target')).closest('article') as HTMLElement
    expect(within(studyCard).getByText('Study time')).toBeInTheDocument()
    expect(within(studyCard).getByText('Weekly')).toBeInTheDocument()
    expect(within(studyCard).getByText('1/5 hours')).toBeInTheDocument()

    await user.click(within(studyCard).getByRole('button', { name: 'Edit Weekly target' }))
    expect(screen.getByLabelText('Metric')).toHaveValue('study_time')
    await user.clear(screen.getByLabelText('Goal title'))
    await user.type(screen.getByLabelText('Goal title'), 'Renamed weekly target')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect((await studyDb.goals.toArray()).find((goal) => goal.title === 'Renamed weekly target')).toMatchObject({
      metric: 'study_time',
      period: 'weekly',
    })

    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Daily target')
    await user.selectOptions(screen.getByLabelText('Metric'), 'study_time')
    await user.selectOptions(screen.getByLabelText('Period'), 'daily')
    await user.clear(screen.getByLabelText(/Target \(minutes\)/))
    await user.type(screen.getByLabelText(/Target \(minutes\)/), '75')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(75)

    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Daily focus manual')
    await user.selectOptions(screen.getByLabelText('Metric'), 'manual')
    await user.selectOptions(screen.getByLabelText('Period'), 'daily')
    await user.clear(screen.getByLabelText(/Target \(points\)/))
    await user.type(screen.getByLabelText(/Target \(points\)/), '80')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(75)

    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.selectOptions(screen.getByLabelText('Metric'), 'manual')
    await user.selectOptions(screen.getByLabelText('Metric'), 'study_time')
    expect(screen.queryByLabelText('Progress (points)')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Metric'), 'manual')
    expect(screen.getByLabelText('Progress (points)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a goal title.')
    await user.type(screen.getByLabelText('Goal title'), 'Invalid target goal')
    const targetInput = screen.getByLabelText(/Target \(points\)/)
    fireEvent.change(targetInput, { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Target must be a number greater than zero.')
    fireEvent.change(targetInput, { target: { value: '0' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Target must be a number greater than zero.')
    fireEvent.change(targetInput, { target: { value: '-3' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Target must be a number greater than zero.')
    fireEvent.change(targetInput, { target: { value: '10' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await studyDb.goals.toArray()).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Invalid target goal', target: 10, metric: 'manual' }),
    ]))

    await studyDb.goals.add({
      id: 'goal-persisted-metric',
      title: 'Persisted study goal',
      target: 4,
      progress: 99,
      period: 'weekly',
      metric: 'study_time',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Persisted study goal' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Edit Persisted study goal' }))
    expect(screen.getByLabelText('Metric')).toHaveValue('study_time')
    expect(screen.queryByLabelText('Progress (points)')).not.toBeInTheDocument()
  }, 20_000)

  it('prevents duplicate goal create while save is pending', async () => {
    const user = userEvent.setup()
    let releaseAdd!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseAdd = resolve
    })
    const originalAdd = studyDb.goals.add.bind(studyDb.goals)
    const addSpy = vi.spyOn(studyDb.goals, 'add').mockImplementation(async (goal) => {
      await gate
      return originalAdd(goal)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Pending goal')
    fireEvent.change(screen.getByLabelText(/Target \(points\)/), { target: { value: '40' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const savingButton = await screen.findByRole('button', { name: 'Creating goal...' })
    expect(savingButton).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByLabelText('Metric')).toBeDisabled()
    await user.click(savingButton)
    expect(addSpy).toHaveBeenCalledTimes(1)

    releaseAdd()
    expect(await screen.findByText('Pending goal')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Goal created.')
    expect(await studyDb.goals.count()).toBe(1)
  })

  it('preserves goal draft after a failed create and allows retry', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const originalAdd = studyDb.goals.add.bind(studyDb.goals)
    const addSpy = vi.spyOn(studyDb.goals, 'add')
      .mockRejectedValueOnce(new Error('IndexedDB goal write failed'))
      .mockImplementation(async (goal) => originalAdd(goal))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Retry goal')
    await user.selectOptions(screen.getByLabelText('Metric'), 'manual')
    await user.selectOptions(screen.getByLabelText('Period'), 'weekly')
    fireEvent.change(screen.getByLabelText(/Target \(points\)/), { target: { value: '55' } })
    fireEvent.change(screen.getByLabelText('Progress (points)'), { target: { value: '11' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Goal could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Goal title')).toHaveValue('Retry goal')
    expect(screen.getByLabelText('Goal title')).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/Target \(points\)/)).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Metric')).toHaveValue('manual')
    expect(screen.getByLabelText('Period')).toHaveValue('weekly')
    expect(screen.getByLabelText(/Target \(points\)/)).toHaveValue(55)
    expect(screen.getByLabelText('Progress (points)')).toHaveValue(11)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Retry goal')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Goal created.')
    expect(addSpy).toHaveBeenCalledTimes(2)
    expect((await studyDb.goals.toArray())[0]).toMatchObject({
      title: 'Retry goal',
      metric: 'manual',
      period: 'weekly',
      target: 55,
      progress: 11,
    })
  })

  it('associates goal validation errors with the responsible controls across metrics', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const titleInput = screen.getByLabelText('Goal title')
    const titleError = screen.getByRole('alert')
    expect(titleError).toHaveTextContent('Enter a goal title.')
    expect(titleError).toHaveAttribute('id', 'goal-title-error')
    expect(titleInput).toHaveAttribute('aria-invalid', 'true')
    expect(titleInput).toHaveAttribute('aria-describedby', 'goal-title-error')
    expect(await studyDb.goals.count()).toBe(0)

    await user.type(titleInput, 'Manual association goal')
    const targetInput = screen.getByLabelText(/Target \(points\)/)
    fireEvent.change(targetInput, { target: { value: '0' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const targetError = screen.getByRole('alert')
    expect(targetError).toHaveTextContent('Target must be a number greater than zero.')
    expect(targetError).toHaveAttribute('id', 'goal-target-error')
    expect(targetInput).toHaveAttribute('aria-invalid', 'true')
    expect(targetInput).toHaveAttribute('aria-describedby', 'goal-target-error')
    expect(titleInput).not.toHaveAttribute('aria-invalid', 'true')
    expect(await studyDb.goals.count()).toBe(0)

    await user.selectOptions(screen.getByLabelText('Metric'), 'study_time')
    expect(screen.queryByLabelText('Progress (points)')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Target \(minutes\)/)).not.toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(screen.getByLabelText(/Target \(minutes\)/), { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const studyTarget = screen.getByLabelText(/Target \(minutes\)/)
    const studyTargetError = screen.getByRole('alert')
    expect(studyTargetError).toHaveTextContent('Target must be a number greater than zero.')
    expect(studyTarget).toHaveAttribute('aria-invalid', 'true')
    expect(studyTarget).toHaveAttribute('aria-describedby', 'goal-target-error')
    expect(await studyDb.goals.count()).toBe(0)

    fireEvent.change(studyTarget, { target: { value: '45' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Manual association goal')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect((await studyDb.goals.toArray())[0]).toMatchObject({
      title: 'Manual association goal',
      metric: 'study_time',
      period: 'daily',
      target: 45,
    })
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(45)
  })

  it('treats a missing-row goal edit as failure and keeps the editor open', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.goals.add({
      id: 'goal-missing-edit',
      title: 'Existing goal',
      target: 30,
      progress: 5,
      period: 'daily',
      metric: 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(studyDb.goals, 'update').mockResolvedValueOnce(0)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(await screen.findByLabelText('Edit Existing goal'))
    await user.clear(screen.getByLabelText('Goal title'))
    await user.type(screen.getByLabelText('Goal title'), 'Edited goal')
    fireEvent.change(screen.getByLabelText(/Target \(points\)/), { target: { value: '45' } })
    fireEvent.change(screen.getByLabelText('Progress (points)'), { target: { value: '9' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Goal could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Goal title')).toHaveValue('Edited goal')
    expect(screen.getByLabelText('Metric')).toHaveValue('manual')
    expect(screen.getByLabelText(/Target \(points\)/)).toHaveValue(45)
    expect(screen.getByLabelText('Progress (points)')).toHaveValue(9)
  })

  it('rolls back daily study-time goal writes when dailyGoalMinutes update fails', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 120 })
    const originalPut = studyDb.settings.put.bind(studyDb.settings)
    vi.spyOn(studyDb.settings, 'put').mockImplementation(async (entry) => {
      if (entry.key === 'dailyGoalMinutes' && entry.value === 90) {
        throw new Error('settings write failed')
      }
      return originalPut(entry)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Atomic daily target')
    await user.selectOptions(screen.getByLabelText('Metric'), 'study_time')
    await user.selectOptions(screen.getByLabelText('Period'), 'daily')
    fireEvent.change(screen.getByLabelText(/Target \(minutes\)/), { target: { value: '90' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Goal could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Goal title')).toHaveValue('Atomic daily target')
    expect(await studyDb.goals.count()).toBe(0)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(120)
  })

  it('updates dailyGoalMinutes only for successful daily study-time goal saves', async () => {
    const user = userEvent.setup()
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 100 })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Daily study minutes')
    await user.selectOptions(screen.getByLabelText('Metric'), 'study_time')
    await user.selectOptions(screen.getByLabelText('Period'), 'daily')
    fireEvent.change(screen.getByLabelText(/Target \(minutes\)/), { target: { value: '80' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Goal created.')
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(80)

    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Daily focus manual')
    await user.selectOptions(screen.getByLabelText('Metric'), 'manual')
    await user.selectOptions(screen.getByLabelText('Period'), 'daily')
    fireEvent.change(screen.getByLabelText(/Target \(points\)/), { target: { value: '70' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Daily focus manual')).toBeInTheDocument()
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(80)
  })

  it('keeps a goal visible when confirmed deletion fails and blocks duplicate deletes', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.goals.add({
      id: 'goal-delete-fail',
      title: 'Sticky goal',
      target: 20,
      progress: 2,
      period: 'daily',
      metric: 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    let releaseDelete!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseDelete = resolve
    })
    const originalDelete = studyDb.goals.delete.bind(studyDb.goals)
    const deleteSpy = vi.spyOn(studyDb.goals, 'delete').mockImplementation(async () => {
      await gate
      throw new Error('delete failed')
    })
    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(await screen.findByLabelText('Delete Sticky goal'))

    expect(await screen.findByLabelText('Deleting Sticky goal')).toBeDisabled()
    expect(screen.getByLabelText('Edit Sticky goal')).toBeDisabled()
    await user.click(screen.getByLabelText('Deleting Sticky goal'))
    expect(deleteSpy).toHaveBeenCalledTimes(1)

    releaseDelete()
    expect(await screen.findByRole('alert')).toHaveTextContent('Goal could not be deleted. Please try again.')
    expect(screen.getByText('Sticky goal')).toBeInTheDocument()

    deleteSpy.mockImplementation(async (id) => originalDelete(id))
    await user.click(screen.getByLabelText('Delete Sticky goal'))
    await waitFor(() => expect(screen.queryByText('Sticky goal')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent('Goal deleted.')
    confirmDelete.mockRestore()
  })

  it('creates a new subject from the subjects view', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Subjects' }))
    await user.click(screen.getByRole('button', { name: 'New subject' }))
    await user.type(screen.getByLabelText('Subject name'), 'Physics')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Physics')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Subject created.')

    const subjects = await studyDb.subjects.toArray()
    expect(subjects).toHaveLength(1)
    expect(subjects[0].name).toBe('Physics')
  })

  it('prevents duplicate subject create while save is pending', async () => {
    const user = userEvent.setup()
    let releaseAdd!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseAdd = resolve
    })
    const originalAdd = studyDb.subjects.add.bind(studyDb.subjects)
    const addSpy = vi.spyOn(studyDb.subjects, 'add').mockImplementation(async (subject) => {
      await gate
      return originalAdd(subject)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Subjects' }))
    await user.click(screen.getByRole('button', { name: 'New subject' }))
    await user.type(screen.getByLabelText('Subject name'), 'Pending subject')
    fireEvent.change(screen.getByLabelText('Target hours'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Progress %'), { target: { value: '20' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const savingButton = await screen.findByRole('button', { name: 'Creating subject...' })
    expect(savingButton).toBeDisabled()
    await user.click(savingButton)
    expect(addSpy).toHaveBeenCalledTimes(1)

    releaseAdd()
    expect(await screen.findByText('Pending subject')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Subject created.')
    expect(await studyDb.subjects.count()).toBe(1)
  })

  it('preserves subject draft after a failed create and allows retry', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const originalAdd = studyDb.subjects.add.bind(studyDb.subjects)
    const addSpy = vi.spyOn(studyDb.subjects, 'add')
      .mockRejectedValueOnce(new Error('IndexedDB subject write failed'))
      .mockImplementation(async (subject) => originalAdd(subject))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Subjects' }))
    await user.click(screen.getByRole('button', { name: 'New subject' }))
    await user.type(screen.getByLabelText('Subject name'), 'Retry subject')
    await user.click(screen.getByLabelText('Use teal'))
    fireEvent.change(screen.getByLabelText('Target hours'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Progress %'), { target: { value: '35' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Subject could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Subject name')).toHaveValue('Retry subject')
    expect(screen.getByLabelText('Target hours')).toHaveValue(7)
    expect(screen.getByLabelText('Progress %')).toHaveValue(35)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Retry subject')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Subject created.')
    expect(await studyDb.subjects.count()).toBe(1)
    expect(addSpy).toHaveBeenCalledTimes(2)
    expect((await studyDb.subjects.toArray())[0].color).toBe('#0f766e')
  })

  it('treats a missing-row subject edit as failure and keeps the editor open', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.subjects.add({
      id: 'subject-missing-edit',
      name: 'Existing subject',
      color: '#2563eb',
      targetHours: 5,
      progress: 10,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(studyDb.subjects, 'update').mockResolvedValueOnce(0)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Subjects' }))
    await user.click(await screen.findByLabelText('Edit Existing subject'))
    await user.clear(screen.getByLabelText('Subject name'))
    await user.type(screen.getByLabelText('Subject name'), 'Edited subject')
    fireEvent.change(screen.getByLabelText('Target hours'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('Progress %'), { target: { value: '40' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Subject could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Subject name')).toHaveValue('Edited subject')
    expect(screen.getByLabelText('Target hours')).toHaveValue(9)
    expect(screen.getByLabelText('Progress %')).toHaveValue(40)
  })

  it('keeps a subject visible when confirmed deletion fails and blocks duplicate deletes', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.subjects.add({
      id: 'subject-delete-fail',
      name: 'Sticky subject',
      color: '#111827',
      targetHours: 3,
      progress: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    let releaseDelete!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseDelete = resolve
    })
    const originalDelete = studyDb.subjects.delete.bind(studyDb.subjects)
    const deleteSpy = vi.spyOn(studyDb.subjects, 'delete').mockImplementation(async () => {
      await gate
      throw new Error('delete failed')
    })
    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Subjects' }))
    await user.click(await screen.findByLabelText('Delete Sticky subject'))

    expect(await screen.findByLabelText('Deleting Sticky subject')).toBeDisabled()
    expect(screen.getByLabelText('Edit Sticky subject')).toBeDisabled()
    await user.click(screen.getByLabelText('Deleting Sticky subject'))
    expect(deleteSpy).toHaveBeenCalledTimes(1)

    releaseDelete()
    expect(await screen.findByRole('alert')).toHaveTextContent('Subject could not be deleted. Please try again.')
    expect(screen.getByText('Sticky subject')).toBeInTheDocument()

    deleteSpy.mockImplementation(async (id) => originalDelete(id))
    await user.click(screen.getByLabelText('Delete Sticky subject'))
    await waitFor(() => expect(screen.queryByText('Sticky subject')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent('Subject deleted.')
    confirmDelete.mockRestore()
  })

  it('saves quick notes from the home page', async () => {
    render(<App />)

    const textarea = await screen.findByPlaceholderText(/Capture fast ideas/i)
    fireEvent.change(textarea, { target: { value: 'Review chapter 5 for exam' } })
    expect(screen.getByText('Saving...')).toBeInTheDocument()

    await waitFor(async () => {
      const setting = await studyDb.settings.get('quickNotes')
      expect(Array.isArray(setting?.value) ? setting!.value[0] : setting?.value).toContain('Review chapter 5')
    })
    expect(screen.getByText('Saved locally')).toBeInTheDocument()
  })

  it('filters tasks by all, open, and done status', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.tasks.add({
      id: 'task-filter-open',
      title: 'Open filter task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await studyDb.tasks.add({
      id: 'task-filter-done',
      title: 'Done filter task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'done',
      minutes: 30,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Tasks' }))

    // Default 'all' filter shows both
    expect(screen.getByText('Open filter task')).toBeInTheDocument()
    expect(screen.getByText('Done filter task')).toBeInTheDocument()

    // Filter to open
    await user.click(screen.getByRole('button', { name: 'open' }))
    expect(screen.getByText('Open filter task')).toBeInTheDocument()
    expect(screen.queryByText('Done filter task')).not.toBeInTheDocument()

    // Filter to done
    await user.click(screen.getByRole('button', { name: 'done' }))
    expect(screen.queryByText('Open filter task')).not.toBeInTheDocument()
    expect(screen.getByText('Done filter task')).toBeInTheDocument()
  })

  it('reports import success and failure', async () => {
    const user = userEvent.setup()
    const validExport = makeEmptyExport()

    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    const importInput = screen.getByLabelText(/Import data/)

    await user.upload(importInput, new File([JSON.stringify(validExport)], 'study-dashboard.json', { type: 'application/json' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Study data imported.')

    await user.upload(importInput, new File(['not valid json'], 'broken.json', { type: 'application/json' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Import failed. Choose a valid Study Dashboard export.')
  })

  it('import replaces all existing study data', async () => {
    const user = userEvent.setup()
    await studyDb.tasks.add({
      id: 'task-to-replace',
      title: 'Will be replaced',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })

    render(<App />)

    await importStudyExport(user, makeEmptyExport(), 'empty.json')
    expect(await screen.findByRole('status')).toHaveTextContent('Study data imported.')

    const tasks = await studyDb.tasks.toArray()
    expect(tasks).toHaveLength(0)
  })

  it('import without activeFocusSession clears a visible focus session and restores Start', async () => {
    const user = userEvent.setup()
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-pre-import',
      subjectId: '',
      plannedMinutes: 0,
    }))

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()

    await importStudyExport(user, makeEmptyExport())
    expect(await screen.findByRole('status')).toHaveTextContent('Study data imported.')

    await user.click(screen.getByRole('button', { name: 'Home' }))
    await waitForFocusStartEnabled()
    expect(screen.queryByRole('button', { name: 'Stop session' })).not.toBeInTheDocument()
    expect(await getActiveFocusSession()).toBeNull()
  })

  it('import of a running session restores subject, duration, and timestamp-derived remaining time', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date('2026-07-21T12:10:00.000Z'))

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-local-before-import',
      subjectId: '',
      plannedMinutes: 0,
    }))

    const importedSession = makeDurableFocusSession({
      id: 'focus-imported-running',
      subjectId: 'subject-import',
      startedAt: '2026-07-21T12:05:00.000Z',
      plannedMinutes: 25,
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: 0,
    })

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()

    await importStudyExport(user, makeEmptyExport({
      subjects: [{
        id: 'subject-import',
        name: 'Chemistry',
        color: '#2563eb',
        targetHours: 4,
        progress: 0,
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T00:00:00.000Z',
      }],
      settings: [{ key: ACTIVE_FOCUS_SESSION_KEY, value: importedSession }],
    }))
    expect(await screen.findByRole('status')).toHaveTextContent('Study data imported.')

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()
    expect(screen.getByLabelText('Focus subject')).toHaveValue('subject-import')
    expect(screen.getByLabelText('Session length')).toHaveValue('25')
    expect(screen.getByText('remaining').parentElement?.querySelector('strong')?.textContent).toBe('20:00')
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-imported-running', status: 'running' })
  })

  it('import of a paused session stays paused with frozen elapsed under advancing timers', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date('2026-07-21T12:10:00.000Z'))

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const importedSession = makeDurableFocusSession({
      id: 'focus-imported-paused',
      subjectId: '',
      startedAt: '2026-07-21T12:00:00.000Z',
      plannedMinutes: 0,
      status: 'paused',
      pausedAt: '2026-07-21T12:06:00.000Z',
      accumulatedPausedMs: 0,
    })

    render(<App />)
    await waitForFocusStartEnabled()

    await importStudyExport(user, makeEmptyExport({
      settings: [{ key: ACTIVE_FOCUS_SESSION_KEY, value: importedSession }],
    }))
    expect(await screen.findByRole('status')).toHaveTextContent('Study data imported.')

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument()
    expect(screen.getByText('paused').parentElement?.querySelector('strong')?.textContent).toBe('06:00')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(screen.getByText('paused').parentElement?.querySelector('strong')?.textContent).toBe('06:00')
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-imported-paused', status: 'paused' })
  })

  it('import of a stale session shows Resume/Discard instead of the normal timer', async () => {
    const user = userEvent.setup()
    const importedSession = makeDurableFocusSession({
      id: 'focus-imported-stale',
      subjectId: '',
      startedAt: new Date(Date.now() - ACTIVE_FOCUS_SESSION_STALE_AFTER_MS - 60_000).toISOString(),
      plannedMinutes: 0,
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: 0,
    })

    render(<App />)
    await waitForFocusStartEnabled()

    await importStudyExport(user, makeEmptyExport({
      settings: [{ key: ACTIVE_FOCUS_SESSION_KEY, value: importedSession }],
    }))
    expect(await screen.findByRole('status')).toHaveTextContent('Study data imported.')

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('heading', { name: 'Unfinished focus session' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume session' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard session' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stop session' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start focus' })).not.toBeInTheDocument()
  })

  it('import with a corrupt activeFocusSession clears focus UI and deletes the corrupt setting', async () => {
    const user = userEvent.setup()
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-before-corrupt-import',
      subjectId: '',
      plannedMinutes: 0,
    }))

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()

    await importStudyExport(user, makeEmptyExport({
      settings: [{ key: ACTIVE_FOCUS_SESSION_KEY, value: { id: '', status: 'running' } }],
    }))
    expect(await screen.findByRole('status')).toHaveTextContent('Study data imported.')

    await user.click(screen.getByRole('button', { name: 'Home' }))
    await waitForFocusStartEnabled()
    expect(screen.queryByRole('button', { name: 'Stop session' })).not.toBeInTheDocument()
    expect(await getActiveFocusSession()).toBeNull()
    expect(await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)).toBeUndefined()
  })

  it('invalid JSON or invalid export structure preserves the original visible focus session', async () => {
    const user = userEvent.setup()
    const existing = makeDurableFocusSession({
      id: 'focus-keep-on-failed-import',
      subjectId: '',
      plannedMinutes: 0,
    })
    await createActiveFocusSession(existing)

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const importInput = screen.getByLabelText(/Import data/)

    await user.upload(importInput, new File(['not valid json'], 'broken.json', { type: 'application/json' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Import failed. Choose a valid Study Dashboard export.')

    await user.upload(importInput, new File([JSON.stringify(makeEmptyExport({
      subjects: [{ id: 'subject-invalid', name: 123 }],
    }))], 'invalid-shape.json', { type: 'application/json' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Import failed. Choose a valid Study Dashboard export.')

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-keep-on-failed-import' })
  })

  it('disables import and focus controls while import synchronization is pending', async () => {
    let releaseImport: () => void = () => {}
    const importGate = new Promise<void>((resolve) => {
      releaseImport = resolve
    })
    const studyDbApi = await import('./db/studyDb')
    const realImport = studyDbApi.importStudyData.bind(studyDbApi)
    vi.spyOn(studyDbApi, 'importStudyData').mockImplementation(async (payload) => {
      await importGate
      return realImport(payload)
    })

    const user = userEvent.setup()
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-import-gate',
      subjectId: '',
      plannedMinutes: 0,
    }))

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const importInput = screen.getByLabelText(/Import data/)
    const file = new File([JSON.stringify(makeEmptyExport())], 'empty.json', { type: 'application/json' })
    await act(async () => {
      fireEvent.change(importInput, { target: { files: [file] } })
    })

    await waitFor(() => expect(importInput).toBeDisabled())
    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeDisabled()

    releaseImport()
    await waitForFocusStartEnabled()
    expect(screen.queryByRole('button', { name: 'Stop session' })).not.toBeInTheDocument()
  })

  it('persists existing theme choices to localStorage', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('radio', { name: /Midnight/ }))
    expect(localStorage.getItem('study-dashboard-theme')).toBe('dark')

    await user.click(screen.getByRole('radio', { name: /Aurora/ }))
    expect(localStorage.getItem('study-dashboard-theme')).toBe('aurora')

    await user.click(screen.getByRole('radio', { name: /Ember/ }))
    expect(localStorage.getItem('study-dashboard-theme')).toBe('ember')
  })

  it('clears active search from the settings panel', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByPlaceholderText('Search'), 'biology')
    expect(screen.getByPlaceholderText('Search')).toHaveValue('biology')

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(screen.getByPlaceholderText('Search')).toHaveValue('')
  })

  it('opens and closes the notice popover', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Good morning' })

    const noticesBtn = screen.getByRole('button', { name: 'Notifications' })
    expect(noticesBtn).toHaveAttribute('aria-expanded', 'false')
    expect(noticesBtn).toHaveAttribute('aria-controls', 'notice-popover')
    expect(document.getElementById('notice-popover')).toBeNull()

    await user.click(noticesBtn)

    expect(noticesBtn).toHaveAttribute('aria-expanded', 'true')
    const popover = document.getElementById('notice-popover')
    expect(popover).not.toBeNull()
    expect(popover).toHaveAttribute('role', 'status')
    expect(within(popover as HTMLElement).getByText(/completed tasks/)).toBeInTheDocument()

    await user.click(noticesBtn)
    expect(noticesBtn).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('notice-popover')).toBeNull()
  })

  it('closes the notice popover with Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Good morning' })
    const noticesBtn = screen.getByRole('button', { name: 'Notifications' })

    await user.click(noticesBtn)
    expect(document.getElementById('notice-popover')).not.toBeNull()
    expect(noticesBtn).toHaveAttribute('aria-expanded', 'true')

    const searchInput = screen.getByPlaceholderText('Search')
    await user.click(searchInput)
    expect(searchInput).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(document.getElementById('notice-popover')).toBeNull()
    expect(noticesBtn).toHaveAttribute('aria-expanded', 'false')
    expect(noticesBtn).toHaveFocus()
  })

  it('Escape closes an open notice popover without clearing search text', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Good morning' })
    const noticesBtn = screen.getByRole('button', { name: 'Notifications' })
    const searchInput = screen.getByPlaceholderText('Search')

    await user.click(searchInput)
    await user.type(searchInput, 'keep-me')
    await user.click(noticesBtn)
    expect(document.getElementById('notice-popover')).not.toBeNull()

    await user.click(searchInput)
    expect(searchInput).toHaveFocus()
    await user.keyboard('{Escape}')

    expect(document.getElementById('notice-popover')).toBeNull()
    expect(searchInput).toHaveValue('keep-me')
    expect(noticesBtn).toHaveFocus()
  })

  it('reopens the notice popover after Escape and keeps search Escape when closed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Good morning' })
    const noticesBtn = screen.getByRole('button', { name: 'Notifications' })
    const searchInput = screen.getByPlaceholderText('Search')

    await user.click(noticesBtn)
    await user.keyboard('{Escape}')
    expect(document.getElementById('notice-popover')).toBeNull()
    expect(noticesBtn).toHaveFocus()

    await user.click(noticesBtn)
    expect(document.getElementById('notice-popover')).not.toBeNull()
    expect(noticesBtn).toHaveAttribute('aria-expanded', 'true')

    await user.click(noticesBtn)
    expect(document.getElementById('notice-popover')).toBeNull()

    await user.click(searchInput)
    await user.type(searchInput, 'calculus')
    await user.keyboard('{Escape}')
    expect(searchInput).toHaveValue('')
    expect(searchInput).not.toHaveFocus()
    expect(document.getElementById('notice-popover')).toBeNull()
  })

  it('exports study data as a JSON file', async () => {
    const user = userEvent.setup()
    render(<App />)

    const createObjectURLMock = vi.fn().mockReturnValue('blob:test-url')
    const revokeObjectURLMock = vi.fn()
    global.URL.createObjectURL = createObjectURLMock
    global.URL.revokeObjectURL = revokeObjectURLMock

    const clickMock = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return { click: clickMock, href: '', download: '', setAttribute: vi.fn() } as unknown as HTMLElement
      }
      return originalCreateElement(tagName)
    })

    await screen.findByRole('heading', { name: 'Good morning' })
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByText('Export data'))

    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalled()
    })
    expect(clickMock).toHaveBeenCalled()
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-url')
    const blob = createObjectURLMock.mock.calls[0][0] as Blob
    const exported = JSON.parse(await blob.text()) as { version: number }
    expect(exported.version).toBe(2)
    expect(await screen.findByRole('status')).toHaveTextContent('Backup exported.')

    createElementSpy.mockRestore()
  })

  it('prevents duplicate export while one export is pending', async () => {
    const user = userEvent.setup()
    let releaseExport!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseExport = resolve
    })
    const studyDbModule = await import('./db/studyDb')
    const originalExport = studyDbModule.exportStudyData
    const exportSpy = vi.spyOn(studyDbModule, 'exportStudyData').mockImplementation(async () => {
      await gate
      return originalExport()
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Settings' }))

    const createObjectURLMock = vi.fn().mockReturnValue('blob:pending-export')
    const revokeObjectURLMock = vi.fn()
    global.URL.createObjectURL = createObjectURLMock
    global.URL.revokeObjectURL = revokeObjectURLMock
    const originalCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return { click: vi.fn(), href: '', download: '', setAttribute: vi.fn() } as unknown as HTMLElement
      }
      return originalCreateElement(tagName)
    })

    await user.click(screen.getByRole('button', { name: /Export data/ }))

    const exportingButton = await screen.findByRole('button', { name: /Exporting backup/ })
    expect(exportingButton).toBeDisabled()
    await user.click(exportingButton)
    expect(exportSpy).toHaveBeenCalledTimes(1)

    releaseExport()
    expect(await screen.findByRole('status')).toHaveTextContent('Backup exported.')
    createElementSpy.mockRestore()
  })

  it('shows a friendly error when backup export fails', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(await import('./db/studyDb'), 'exportStudyData').mockRejectedValueOnce(new Error('serialize failed'))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: /Export data/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Backup could not be exported.')
    expect(screen.queryByText(/serialize failed/i)).not.toBeInTheDocument()
  })

  it('keeps clear-all confirmation state when clearing fails and blocks duplicate clears', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await studyDb.tasks.add({
      id: 'task-clear-fail',
      title: 'Keep me',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 20,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })

    let releaseClear!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseClear = resolve
    })
    const originalClear = studyDb.tasks.clear.bind(studyDb.tasks)
    const clearSpy = vi.spyOn(studyDb.tasks, 'clear').mockImplementation(async () => {
      await gate
      throw new Error('clear failed')
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: /Reset all study data/ }))
    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
    await user.click(screen.getByRole('button', { name: 'Delete all data' }))

    expect(await screen.findByRole('button', { name: 'Clearing...' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Clearing...' }))
    expect(clearSpy).toHaveBeenCalledTimes(1)

    releaseClear()
    expect(await screen.findByRole('alert')).toHaveTextContent('Study data could not be cleared. Please try again.')
    expect(screen.getByPlaceholderText('DELETE')).toHaveValue('DELETE')
    expect(await studyDb.tasks.count()).toBe(1)

    clearSpy.mockImplementation(async () => originalClear())
    await user.click(screen.getByRole('button', { name: 'Delete all data' }))
    expect(await screen.findByRole('heading', { name: 'Good morning' })).toBeInTheDocument()
    expect(await studyDb.tasks.count()).toBe(0)
  })

  it('preserves quick-note drafts on failure and keeps newest write last', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<App />)
    const textarea = await screen.findByPlaceholderText(/Capture fast ideas/i)

    const originalPut = studyDb.settings.put.bind(studyDb.settings)
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const putSpy = vi.spyOn(studyDb.settings, 'put').mockImplementation(async (entry) => {
      if (entry.key !== 'quickNotes') return originalPut(entry)
      await firstGate
      throw new Error('quick notes write failed')
    })

    fireEvent.change(textarea, { target: { value: 'First draft line' } })
    expect(await screen.findByText('Saving...')).toBeInTheDocument()
    await waitFor(() => expect(putSpy).toHaveBeenCalled())
    releaseFirst()

    expect(await screen.findByRole('alert')).toHaveTextContent('Quick notes could not be saved. Your text is still available.')
    expect(textarea).toHaveValue('First draft line')

    putSpy.mockImplementation(async (entry) => originalPut(entry))
    let olderRelease!: () => void
    let newerRelease!: () => void
    const olderGate = new Promise<void>((resolve) => {
      olderRelease = resolve
    })
    const newerGate = new Promise<void>((resolve) => {
      newerRelease = resolve
    })
    const writes: string[] = []
    putSpy.mockImplementation(async (entry) => {
      if (entry.key !== 'quickNotes') return originalPut(entry)
      const value = Array.isArray(entry.value) ? entry.value.join('\n') : String(entry.value)
      if (value.includes('Older')) {
        await olderGate
      } else {
        await newerGate
      }
      writes.push(value)
      return originalPut(entry)
    })

    fireEvent.change(textarea, { target: { value: 'Older value' } })
    await waitFor(() => expect(putSpy).toHaveBeenCalled())
    fireEvent.change(textarea, { target: { value: 'Newer value' } })
    newerRelease()
    olderRelease()

    await waitFor(() => expect(screen.getByText('Saved locally')).toBeInTheDocument())
    expect(writes.at(-1)).toContain('Newer value')
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual(['Newer value'])
  })

  it('shows friendly feedback when theme preference persistence fails', async () => {
    const user = userEvent.setup()
    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'study-dashboard-theme') throw new Error('quota exceeded')
      return originalSetItem.call(this, key, value)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('radio', { name: /Midnight/ }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(await screen.findByRole('alert')).toHaveTextContent('Theme preference could not be saved.')
    expect(screen.queryByText(/quota exceeded/i)).not.toBeInTheDocument()
  })

  it('logs focus session automatically when time limit is reached', async () => {
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 120 })
    await studyDb.settings.put({ key: 'quickNotes', value: ['Test Note'] })
    await studyDb.subjects.add({ id: 'subj-cov', name: 'CovSubject', progress: 0, color: '#000000', targetHours: 1, createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' })
    await studyDb.flashcards.add({ id: 'fc-cov', subjectId: 'subj-cov', front: 'Q', back: 'A', status: 'new', dueAt: new Date().toISOString(), lastReviewedAt: '', createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' })

    const nearlyDone = makeDurableFocusSession({
      id: 'focus-auto-complete',
      subjectId: 'subj-cov',
      startedAt: new Date(Date.now() - (25 * 60_000 - 40)).toISOString(),
      plannedMinutes: 25,
    })
    await createActiveFocusSession(nearlyDone)

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()

    await waitFor(async () => {
      expect(screen.queryByRole('button', { name: 'Stop session' })).not.toBeInTheDocument()
      expect(await studyDb.studySessions.count()).toBe(1)
    }, { timeout: 3000 })

    expect(screen.getByText(/Session complete: \d+m logged/)).toBeInTheDocument()
    expect(await getActiveFocusSession()).toBeNull()
  })

  it('restores a running focus session after remount', async () => {
    await studyDb.subjects.add({
      id: 'subject-focus',
      name: 'Physics',
      color: '#2563eb',
      targetHours: 6,
      progress: 10,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })
    const session = makeDurableFocusSession({
      id: 'focus-remount',
      subjectId: 'subject-focus',
      plannedMinutes: 50,
    })
    await createActiveFocusSession(session)

    const first = render(<App />)
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()
    expect(screen.getByLabelText('Focus subject')).toHaveValue('subject-focus')
    expect(screen.getByLabelText('Session length')).toHaveValue('50')
    first.unmount()

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()
    expect(screen.getByLabelText('Focus subject')).toHaveValue('subject-focus')
    expect(screen.getByLabelText('Session length')).toHaveValue('50')
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-remount', plannedMinutes: 50 })
  })

  it('keeps Start disabled until focus restoration finishes', async () => {
    let releaseRestore: (value: ActiveFocusSession | null) => void = () => {}
    const restoreGate = new Promise<ActiveFocusSession | null>((resolve) => {
      releaseRestore = resolve
    })
    vi.spyOn(await import('./db/activeFocusSession'), 'getActiveFocusSession').mockImplementation(() => restoreGate)

    render(<App />)
    const startButton = await screen.findByRole('button', { name: 'Start focus' })
    expect(startButton).toBeDisabled()

    releaseRestore(null)
    await waitFor(() => expect(startButton).toBeEnabled())
  })

  it('hydrates the existing durable session when Start conflicts', async () => {
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-focus',
      name: 'Physics',
      color: '#2563eb',
      targetHours: 6,
      progress: 10,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })
    const existing = makeDurableFocusSession({
      id: 'focus-conflict',
      subjectId: 'subject-focus',
      plannedMinutes: 50,
    })
    await createActiveFocusSession(existing)

    const activeFocusApi = await import('./db/activeFocusSession')
    vi.spyOn(activeFocusApi, 'getActiveFocusSession').mockResolvedValueOnce(null)

    render(<App />)
    await waitForFocusStartEnabled()
    await user.click(screen.getByRole('button', { name: 'Start focus' }))

    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()
    expect(screen.getByText('An unfinished focus session was restored.')).toBeInTheDocument()
    expect(screen.getByLabelText('Session length')).toHaveValue('50')
    expect((await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY))?.value).toMatchObject({ id: 'focus-conflict', plannedMinutes: 50 })
  })

  it('finalizes an already-expired restored timed session once', async () => {
    await studyDb.subjects.add({
      id: 'subject-focus',
      name: 'Physics',
      color: '#2563eb',
      targetHours: 6,
      progress: 10,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-expired',
      subjectId: 'subject-focus',
      startedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      plannedMinutes: 25,
    }))

    render(<App />)

    await waitFor(async () => {
      expect(await studyDb.studySessions.count()).toBe(1)
      expect(await getActiveFocusSession()).toBeNull()
    })
    expect(screen.getByText(/Session complete: \d+m logged/)).toBeInTheDocument()

    const sessions = await studyDb.studySessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe('focus-expired')
    expect(sessions[0].minutes).toBe(25)
  })

  it('records manual stop minutes from active elapsed time excluding paused time', async () => {
    const user = userEvent.setup()
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-manual-stop',
      subjectId: '',
      startedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      plannedMinutes: 0,
      accumulatedPausedMs: 4 * 60_000,
    }))

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop session' }))

    await waitFor(async () => {
      const sessions = await studyDb.studySessions.toArray()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].minutes).toBe(6)
      expect(sessions[0].note).toBe('General focus session')
    })
    expect(await getActiveFocusSession()).toBeNull()
  })

  it('keeps a restored paused session frozen without auto-completing', async () => {
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-paused',
      subjectId: '',
      startedAt: new Date(Date.now() - 40 * 60_000).toISOString(),
      plannedMinutes: 25,
      status: 'paused',
      pausedAt: new Date(Date.now() - 35 * 60_000).toISOString(),
      accumulatedPausedMs: 0,
    }))

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start focus' })).not.toBeInTheDocument()

    await new Promise((resolve) => window.setTimeout(resolve, 80))
    expect(await studyDb.studySessions.count()).toBe(0)
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-paused', status: 'paused' })
  })

  it('retains recoverable state when finalization fails', async () => {
    const user = userEvent.setup()
    const session = makeDurableFocusSession({
      id: 'focus-fail-finalize',
      subjectId: '',
      plannedMinutes: 0,
    })
    await createActiveFocusSession(session)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(await import('./db/activeFocusSession'), 'finalizeActiveFocusSession').mockRejectedValueOnce(new Error('write failed'))

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop session' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop session' })).toBeInTheDocument())
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not stop the focus session. Try again.')
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-fail-finalize' })
    expect(await studyDb.studySessions.count()).toBe(0)
  })

  it('shows a notice when focus start persistence rejects', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(await import('./db/activeFocusSession'), 'createActiveFocusSession').mockRejectedValueOnce(new Error('start failed'))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Start focus' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not start the focus session. Try again.')
    expect(screen.getByRole('button', { name: 'Start focus' })).toBeInTheDocument()
    expect(await getActiveFocusSession()).toBeNull()
  })

  it('restores durable focus subject when subject persistence fails', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await studyDb.subjects.add({
      id: 'subject-focus-a',
      name: 'Algebra',
      color: '#2563eb',
      targetHours: 4,
      progress: 0,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })
    await studyDb.subjects.add({
      id: 'subject-focus-b',
      name: 'Biology',
      color: '#0f766e',
      targetHours: 4,
      progress: 0,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-subject-fail',
      subjectId: 'subject-focus-a',
      plannedMinutes: 0,
    }))
    vi.spyOn(await import('./db/activeFocusSession'), 'updateActiveFocusSession').mockRejectedValueOnce(new Error('subject write failed'))

    render(<App />)
    expect(await screen.findByLabelText('Focus subject')).toHaveValue('subject-focus-a')
    await user.selectOptions(screen.getByLabelText('Focus subject'), 'subject-focus-b')

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update the focus subject. Try again.')
    expect(screen.getByLabelText('Focus subject')).toHaveValue('subject-focus-a')
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-subject-fail', subjectId: 'subject-focus-a' })
  })

  it('clears obsolete focus UI when Stop finds no matching persisted session', async () => {
    const user = userEvent.setup()
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-missing-stop',
      subjectId: '',
      plannedMinutes: 0,
    }))

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()

    await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
    expect(await getActiveFocusSession()).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Stop session' }))

    expect(await screen.findByText(/no longer saved/i)).toBeInTheDocument()
    expect(screen.queryByText(/Session complete:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Session stopped:/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stop session' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Unfinished focus session' })).not.toBeInTheDocument()
    await waitForFocusStartEnabled()
    expect(await studyDb.studySessions.count()).toBe(0)
    expect(await getActiveFocusSession()).toBeNull()
  })

  it('hydrates a different durable session when Stop conflicts instead of clearing it', async () => {
    const user = userEvent.setup()
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-stop-local',
      subjectId: '',
      plannedMinutes: 0,
    }))

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()

    const other = makeDurableFocusSession({
      id: 'focus-stop-other',
      subjectId: '',
      plannedMinutes: 50,
      startedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    })
    await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: other })

    await user.click(screen.getByRole('button', { name: 'Stop session' }))

    expect(await screen.findByText('Focus session was updated elsewhere.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop session' })).toBeInTheDocument()
    expect(screen.getByLabelText('Session length')).toHaveValue('50')
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-stop-other', plannedMinutes: 50 })
    expect(await studyDb.studySessions.count()).toBe(0)
  })

  it('does not create duplicate history rows for repeated finalization', async () => {
    const session = makeDurableFocusSession({
      id: 'focus-idempotent',
      subjectId: '',
      plannedMinutes: 0,
      startedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    })
    await createActiveFocusSession(session)

    const first = await finalizeActiveFocusSession(session.id, {
      subjectId: '',
      startedAt: session.startedAt,
      endedAt: new Date().toISOString(),
      minutes: 3,
      note: 'Focus session',
    })
    const second = await finalizeActiveFocusSession(session.id, {
      subjectId: '',
      startedAt: session.startedAt,
      endedAt: new Date().toISOString(),
      minutes: 99,
      note: 'Duplicate',
    })

    expect(first.ok).toBe(true)
    expect(second).toEqual(first)
    expect(await studyDb.studySessions.count()).toBe(1)
    expect(await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)).toBeUndefined()
  })

  it('pauses durably and restores frozen paused state after remount', async () => {
    const user = userEvent.setup()
    const first = render(<App />)
    await waitForFocusStartEnabled()
    await user.click(screen.getByRole('button', { name: 'Start focus' }))
    await user.click(await screen.findByRole('button', { name: 'Pause' }))
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument()
    expect(screen.getByText('paused')).toBeInTheDocument()

    const paused = await getActiveFocusSession()
    expect(paused).toMatchObject({ status: 'paused' })
    expect(paused?.pausedAt).toBeTruthy()
    const elapsedStrong = screen.getByText('Elapsed').parentElement?.querySelector('strong')?.textContent
    first.unmount()

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument()
    expect(screen.getByText('paused')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
    expect(screen.getByText('Elapsed').parentElement?.querySelector('strong')?.textContent).toBe(elapsedStrong)
    expect(await getActiveFocusSession()).toMatchObject({ id: paused!.id, status: 'paused', pausedAt: paused!.pausedAt })
  })

  it('resumes after pause and excludes paused time from study minutes', async () => {
    const user = userEvent.setup()
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-resume-flow',
      subjectId: '',
      startedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      plannedMinutes: 0,
      status: 'paused',
      pausedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
      accumulatedPausedMs: 0,
    }))

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Resume' }))

    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument()
    const resumed = await getActiveFocusSession()
    expect(resumed).toMatchObject({ status: 'running', pausedAt: null })
    expect(resumed!.accumulatedPausedMs).toBeGreaterThanOrEqual(4 * 60_000 - 1500)

    await user.click(screen.getByRole('button', { name: 'Stop session' }))
    await waitFor(async () => {
      const sessions = await studyDb.studySessions.toArray()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].minutes).toBe(6)
    })
  })

  it('freezes timed auto-complete while paused and finishes remaining time after resume', async () => {
    const user = userEvent.setup()
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-timed-pause',
      subjectId: '',
      startedAt: new Date(Date.now() - (25 * 60_000 - 80)).toISOString(),
      plannedMinutes: 25,
      status: 'paused',
      pausedAt: new Date().toISOString(),
      accumulatedPausedMs: 0,
    }))

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument()
    await new Promise((resolve) => window.setTimeout(resolve, 120))
    expect(await studyDb.studySessions.count()).toBe(0)
    expect(await getActiveFocusSession()).toMatchObject({ status: 'paused' })

    await user.click(screen.getByRole('button', { name: 'Resume' }))
    await waitFor(async () => {
      expect(await studyDb.studySessions.count()).toBe(1)
      expect(await getActiveFocusSession()).toBeNull()
    }, { timeout: 3000 })
    expect(screen.getByText(/Session complete: \d+m logged/)).toBeInTheDocument()
  })

  it('defers timed auto-complete while Pause is pending and successful Pause wins', async () => {
    const user = userEvent.setup()
    const remainingMs = 2000
    const sessionId = 'focus-race-pause-win'
    await createActiveFocusSession(makeDurableFocusSession({
      id: sessionId,
      subjectId: '',
      startedAt: new Date(Date.now() - (25 * 60_000 - remainingMs)).toISOString(),
      plannedMinutes: 25,
    }))

    let releasePause!: () => void
    let pauseGateSettled = false
    const pauseGate = new Promise<void>((resolve) => {
      releasePause = () => {
        pauseGateSettled = true
        resolve()
      }
    })
    const activeFocusApi = await import('./db/activeFocusSession')
    const originalPause = activeFocusApi.pauseActiveFocusSession.bind(activeFocusApi)
    vi.spyOn(activeFocusApi, 'pauseActiveFocusSession').mockImplementation(async (id, pausedAt) => {
      await pauseGate
      return originalPause(id, pausedAt)
    })

    try {
      render(<App />)
      const pauseButton = await screen.findByRole('button', { name: 'Pause' })
      await user.click(pauseButton)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled())

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, remainingMs + 250))
      })
      expect(await studyDb.studySessions.count()).toBe(0)
      expect(screen.queryByText(/Session complete:/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled()
      expect(await getActiveFocusSession()).toMatchObject({ id: sessionId, status: 'running' })

      releasePause()
      await waitFor(async () => {
        expect(await getActiveFocusSession()).toMatchObject({ id: sessionId, status: 'paused' })
      })
      expect(pauseGateSettled).toBe(true)
      expect(await studyDb.studySessions.count()).toBe(0)
      expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
      expect(screen.getByText('paused')).toBeInTheDocument()
      expect(screen.queryByText(/Session complete:/)).not.toBeInTheDocument()
      const frozenElapsed = screen.getByText('Elapsed').parentElement?.querySelector('strong')?.textContent
      expect(frozenElapsed).toMatch(/^\d{2}:\d{2}$/)
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 120))
      })
      expect(screen.getByText('Elapsed').parentElement?.querySelector('strong')?.textContent).toBe(frozenElapsed)
    } finally {
      if (!pauseGateSettled) releasePause()
    }
  }, 15_000)

  it('finalizes once after failed Pause when durable session remains running and complete', async () => {
    const user = userEvent.setup()
    const remainingMs = 2000
    const sessionId = 'focus-race-pause-fail'
    await createActiveFocusSession(makeDurableFocusSession({
      id: sessionId,
      subjectId: '',
      startedAt: new Date(Date.now() - (25 * 60_000 - remainingMs)).toISOString(),
      plannedMinutes: 25,
    }))

    let rejectPause!: (error?: Error) => void
    let pauseGateSettled = false
    const pauseGate = new Promise<never>((_, reject) => {
      rejectPause = (error = new Error('write failed')) => {
        pauseGateSettled = true
        reject(error)
      }
    })
    pauseGate.catch(() => undefined)
    const activeFocusApi = await import('./db/activeFocusSession')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(activeFocusApi, 'pauseActiveFocusSession').mockImplementation(async () => {
      await pauseGate
      throw new Error('unreachable')
    })

    try {
      render(<App />)
      await user.click(await screen.findByRole('button', { name: 'Pause' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled())

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, remainingMs + 250))
      })
      expect(await studyDb.studySessions.count()).toBe(0)
      expect(screen.queryByText(/Session complete:/)).not.toBeInTheDocument()

      rejectPause()
      expect(await screen.findByText('Could not pause the focus session. Try again.')).toBeInTheDocument()

      await waitFor(async () => {
        expect(await studyDb.studySessions.count()).toBe(1)
        expect(await getActiveFocusSession()).toBeNull()
      })
      const history = await studyDb.studySessions.toArray()
      expect(history).toHaveLength(1)
      expect(history[0].id).toBe(sessionId)
      expect(history[0].minutes).toBe(25)
      // Deferred finalize reuses the single sessionNotice slot after the pause failure was shown.
      expect(screen.getByText(/Session complete: \d+m logged/)).toBeInTheDocument()
    } finally {
      if (!pauseGateSettled) rejectPause()
    }
  }, 15_000)

  it('keeps Resume pending from writing history before durable settlement', async () => {
    const user = userEvent.setup()
    const sessionId = 'focus-race-resume-pending'
    // Active elapsed is 20m; wall clock is already past the 25m plan.
    await createActiveFocusSession(makeDurableFocusSession({
      id: sessionId,
      subjectId: '',
      startedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      plannedMinutes: 25,
      status: 'paused',
      pausedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      accumulatedPausedMs: 0,
    }))

    let releaseResume!: () => void
    let resumeGateSettled = false
    const resumeGate = new Promise<void>((resolve) => {
      releaseResume = () => {
        resumeGateSettled = true
        resolve()
      }
    })
    const activeFocusApi = await import('./db/activeFocusSession')
    const originalResume = activeFocusApi.resumeActiveFocusSession.bind(activeFocusApi)
    vi.spyOn(activeFocusApi, 'resumeActiveFocusSession').mockImplementation(async (id, resumedAtMs) => {
      await resumeGate
      return originalResume(id, resumedAtMs)
    })

    try {
      render(<App />)
      await user.click(await screen.findByRole('button', { name: 'Resume' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Resume' })).toBeDisabled())

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 200))
      })
      expect(await studyDb.studySessions.count()).toBe(0)
      expect(await getActiveFocusSession()).toMatchObject({ id: sessionId, status: 'paused' })
      expect(screen.queryByText(/Session complete:/)).not.toBeInTheDocument()

      releaseResume()
      await waitFor(async () => {
        expect(await getActiveFocusSession()).toMatchObject({ id: sessionId, status: 'running', pausedAt: null })
      })
      expect(resumeGateSettled).toBe(true)
      const resumed = await getActiveFocusSession()
      expect(resumed!.accumulatedPausedMs).toBeGreaterThanOrEqual(10 * 60_000 - 2_000)
      expect(await studyDb.studySessions.count()).toBe(0)
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
      expect(screen.queryByText(/Session complete:/)).not.toBeInTheDocument()
    } finally {
      if (!resumeGateSettled) releaseResume()
    }
  }, 15_000)

  it('waits remaining active time after Resume before timed completion', async () => {
    const user = userEvent.setup()
    const remainingMs = 2000
    const sessionId = 'focus-race-resume-remaining'
    await createActiveFocusSession(makeDurableFocusSession({
      id: sessionId,
      subjectId: '',
      startedAt: new Date(Date.now() - (25 * 60_000 - remainingMs)).toISOString(),
      plannedMinutes: 25,
      status: 'paused',
      pausedAt: new Date().toISOString(),
      accumulatedPausedMs: 0,
    }))

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument()
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 150))
    })
    expect(await studyDb.studySessions.count()).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Resume' }))
    await waitFor(async () => {
      expect(await getActiveFocusSession()).toMatchObject({ id: sessionId, status: 'running' })
    })
    expect(await studyDb.studySessions.count()).toBe(0)

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, remainingMs + 250))
    })
    await waitFor(async () => {
      expect(await studyDb.studySessions.count()).toBe(1)
      expect(await getActiveFocusSession()).toBeNull()
    })
    const history = await studyDb.studySessions.toArray()
    expect(history).toHaveLength(1)
    expect(history[0].id).toBe(sessionId)
    expect(history[0].minutes).toBe(25)
    expect(screen.getByText(/Session complete: \d+m logged/)).toBeInTheDocument()
  }, 15_000)

  it('keeps failed Resume paused without auto-completing past wall-clock plan', async () => {
    const user = userEvent.setup()
    const sessionId = 'focus-race-resume-fail'
    await createActiveFocusSession(makeDurableFocusSession({
      id: sessionId,
      subjectId: '',
      startedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      plannedMinutes: 25,
      status: 'paused',
      pausedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      accumulatedPausedMs: 0,
    }))

    let rejectResume!: (error?: Error) => void
    let resumeGateSettled = false
    const resumeGate = new Promise<never>((_, reject) => {
      rejectResume = (error = new Error('write failed')) => {
        resumeGateSettled = true
        reject(error)
      }
    })
    resumeGate.catch(() => undefined)
    const activeFocusApi = await import('./db/activeFocusSession')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(activeFocusApi, 'resumeActiveFocusSession').mockImplementation(async () => {
      await resumeGate
      throw new Error('unreachable')
    })

    try {
      render(<App />)
      await user.click(await screen.findByRole('button', { name: 'Resume' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Resume' })).toBeDisabled())

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 200))
      })
      expect(await studyDb.studySessions.count()).toBe(0)

      rejectResume()
      expect(await screen.findByText('Could not resume the focus session. Try again.')).toBeInTheDocument()
      expect(await getActiveFocusSession()).toMatchObject({ id: sessionId, status: 'paused' })
      expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
      expect(screen.getByText('paused')).toBeInTheDocument()
      expect(await studyDb.studySessions.count()).toBe(0)
      expect(screen.queryByText(/Session complete:/)).not.toBeInTheDocument()

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 200))
      })
      expect(await studyDb.studySessions.count()).toBe(0)
      expect(await getActiveFocusSession()).toMatchObject({ id: sessionId, status: 'paused' })
    } finally {
      if (!resumeGateSettled) rejectResume()
    }
  }, 15_000)

  it('does not finalize session A when Pause settles with a replacement session B', async () => {
    const user = userEvent.setup()
    const remainingMs = 2000
    const sessionA = 'focus-race-conflict-a'
    const sessionB = makeDurableFocusSession({
      id: 'focus-race-conflict-b',
      subjectId: '',
      startedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
      plannedMinutes: 50,
      status: 'running',
    })
    await createActiveFocusSession(makeDurableFocusSession({
      id: sessionA,
      subjectId: '',
      startedAt: new Date(Date.now() - (25 * 60_000 - remainingMs)).toISOString(),
      plannedMinutes: 25,
    }))

    let releasePause!: () => void
    let pauseGateSettled = false
    const pauseGate = new Promise<void>((resolve) => {
      releasePause = () => {
        pauseGateSettled = true
        resolve()
      }
    })
    const activeFocusApi = await import('./db/activeFocusSession')
    vi.spyOn(activeFocusApi, 'pauseActiveFocusSession').mockImplementation(async () => {
      await pauseGate
      return { ok: false, reason: 'conflict', existing: sessionB }
    })

    try {
      render(<App />)
      await user.click(await screen.findByRole('button', { name: 'Pause' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled())

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, remainingMs + 250))
      })
      expect(await studyDb.studySessions.count()).toBe(0)

      await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: sessionB })
      releasePause()
      await waitFor(() => {
        expect(screen.getByText('Focus session was updated elsewhere.')).toBeInTheDocument()
      })
      expect(pauseGateSettled).toBe(true)
      expect(await getActiveFocusSession()).toMatchObject({ id: sessionB.id, plannedMinutes: 50 })
      expect(screen.getByLabelText('Session length')).toHaveValue('50')
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
      expect(await studyDb.studySessions.count()).toBe(0)
      expect(screen.queryByText(/Session complete:/)).not.toBeInTheDocument()
      expect((await studyDb.studySessions.toArray()).find((row) => row.id === sessionA)).toBeUndefined()
    } finally {
      if (!pauseGateSettled) releasePause()
    }
  }, 15_000)

  it('writes no history when Pause settles missing after deferred completion was queued', async () => {
    const user = userEvent.setup()
    const remainingMs = 2000
    const sessionId = 'focus-race-missing'
    await createActiveFocusSession(makeDurableFocusSession({
      id: sessionId,
      subjectId: '',
      startedAt: new Date(Date.now() - (25 * 60_000 - remainingMs)).toISOString(),
      plannedMinutes: 25,
    }))

    let releasePause!: () => void
    let pauseGateSettled = false
    const pauseGate = new Promise<void>((resolve) => {
      releasePause = () => {
        pauseGateSettled = true
        resolve()
      }
    })
    const activeFocusApi = await import('./db/activeFocusSession')
    vi.spyOn(activeFocusApi, 'pauseActiveFocusSession').mockImplementation(async () => {
      await pauseGate
      return { ok: false, reason: 'missing' }
    })

    try {
      render(<App />)
      await user.click(await screen.findByRole('button', { name: 'Pause' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled())

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, remainingMs + 250))
      })
      expect(await studyDb.studySessions.count()).toBe(0)

      await clearActiveFocusSession()
      releasePause()
      expect(await screen.findByText('Could not pause the focus session. Try again.')).toBeInTheDocument()
      expect(pauseGateSettled).toBe(true)
      expect(screen.queryByText(/no longer saved/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Session complete:/)).not.toBeInTheDocument()
      expect(await studyDb.studySessions.count()).toBe(0)
      expect(await getActiveFocusSession()).toBeNull()

      await createActiveFocusSession(makeDurableFocusSession({
        id: 'focus-race-missing-next',
        subjectId: '',
        startedAt: new Date(Date.now() - 60_000).toISOString(),
        plannedMinutes: 50,
      }))
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 200))
      })
      expect(await studyDb.studySessions.count()).toBe(0)
      expect((await studyDb.studySessions.toArray()).find((row) => row.id === sessionId)).toBeUndefined()
    } finally {
      if (!pauseGateSettled) releasePause()
    }
  }, 15_000)

  it('keeps failed-Pause deferred completion idempotent across settlement and timer paths', async () => {
    const user = userEvent.setup()
    const remainingMs = 2000
    const sessionId = 'focus-race-idempotent'
    await createActiveFocusSession(makeDurableFocusSession({
      id: sessionId,
      subjectId: '',
      startedAt: new Date(Date.now() - (25 * 60_000 - remainingMs)).toISOString(),
      plannedMinutes: 25,
    }))

    let rejectPause!: (error?: Error) => void
    let pauseGateSettled = false
    const pauseGate = new Promise<never>((_, reject) => {
      rejectPause = (error = new Error('write failed')) => {
        pauseGateSettled = true
        reject(error)
      }
    })
    pauseGate.catch(() => undefined)
    const activeFocusApi = await import('./db/activeFocusSession')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(activeFocusApi, 'pauseActiveFocusSession').mockImplementation(async () => {
      await pauseGate
      throw new Error('unreachable')
    })

    try {
      render(<App />)
      await user.click(await screen.findByRole('button', { name: 'Pause' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled())

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, remainingMs + 250))
      })
      expect(await studyDb.studySessions.count()).toBe(0)

      rejectPause()
      expect(await screen.findByText('Could not pause the focus session. Try again.')).toBeInTheDocument()

      await waitFor(async () => {
        expect(await studyDb.studySessions.count()).toBe(1)
        expect(await getActiveFocusSession()).toBeNull()
      })

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 300))
      })
      const history = await studyDb.studySessions.toArray()
      expect(history).toHaveLength(1)
      expect(history[0].id).toBe(sessionId)
      expect(screen.getAllByText(/Session complete: \d+m logged/)).toHaveLength(1)
    } finally {
      if (!pauseGateSettled) rejectPause()
    }
  }, 15_000)

  it('keeps visible status when pause persistence fails', async () => {
    const user = userEvent.setup()
    const activeFocusApi = await import('./db/activeFocusSession')
    vi.spyOn(activeFocusApi, 'pauseActiveFocusSession').mockRejectedValueOnce(new Error('write failed'))

    render(<App />)
    await waitForFocusStartEnabled()
    await user.click(screen.getByRole('button', { name: 'Start focus' }))
    await user.click(await screen.findByRole('button', { name: 'Pause' }))

    expect(await screen.findByText('Could not pause the focus session. Try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(await getActiveFocusSession()).toMatchObject({ status: 'running' })
  })

  it('rejects a second pause while already paused without corrupting totals', async () => {
    const session = makeDurableFocusSession({
      id: 'focus-double-pause',
      subjectId: '',
      startedAt: new Date(Date.now() - 8 * 60_000).toISOString(),
      plannedMinutes: 0,
    })
    await createActiveFocusSession(session)
    const first = await pauseActiveFocusSession(session.id, new Date(Date.now() - 2 * 60_000).toISOString())
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = await pauseActiveFocusSession(session.id)
    expect(second).toEqual({ ok: false, reason: 'invalid_state', existing: first.session })
    expect(await getActiveFocusSession()).toEqual(first.session)
  })

  it('restores a non-stale unfinished session without a resume/discard decision', async () => {
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-fresh',
      subjectId: '',
      startedAt: new Date(Date.now() - (ACTIVE_FOCUS_SESSION_STALE_AFTER_MS - 60_000)).toISOString(),
      plannedMinutes: 0,
    }))

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Unfinished focus session' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resume session' })).not.toBeInTheDocument()
  })

  it('holds an exactly 12-hour-old session for Resume or Discard before hydration', async () => {
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-stale-boundary',
      subjectId: '',
      startedAt: new Date(Date.now() - ACTIVE_FOCUS_SESSION_STALE_AFTER_MS).toISOString(),
      plannedMinutes: 25,
      status: 'running',
    }))

    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Unfinished focus session' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume session' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard session' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start focus' })).not.toBeInTheDocument()

    await new Promise((resolve) => window.setTimeout(resolve, 80))
    expect(await studyDb.studySessions.count()).toBe(0)
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-stale-boundary', status: 'running' })
  })

  it('keeps a stale paused session pending without auto-completing', async () => {
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-stale-paused',
      subjectId: '',
      startedAt: new Date(Date.now() - ACTIVE_FOCUS_SESSION_STALE_AFTER_MS - 60_000).toISOString(),
      plannedMinutes: 25,
      status: 'paused',
      pausedAt: new Date(Date.now() - ACTIVE_FOCUS_SESSION_STALE_AFTER_MS).toISOString(),
    }))

    render(<App />)
    expect(await screen.findByText(/It was paused for General/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument()
    await new Promise((resolve) => window.setTimeout(resolve, 80))
    expect(await studyDb.studySessions.count()).toBe(0)
  })

  it('resumes a stale session without rewriting durable pause totals', async () => {
    const user = userEvent.setup()
    const startedAt = new Date(Date.now() - ACTIVE_FOCUS_SESSION_STALE_AFTER_MS - 120_000).toISOString()
    const pausedAt = new Date(Date.now() - ACTIVE_FOCUS_SESSION_STALE_AFTER_MS).toISOString()
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-stale-resume',
      subjectId: '',
      startedAt,
      plannedMinutes: 0,
      status: 'paused',
      pausedAt,
      accumulatedPausedMs: 90_000,
    }))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Resume session' }))

    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument()
    expect(screen.getByText('paused')).toBeInTheDocument()
    expect(await getActiveFocusSession()).toMatchObject({
      id: 'focus-stale-resume',
      startedAt,
      pausedAt,
      accumulatedPausedMs: 90_000,
      status: 'paused',
    })
  })

  it('completes an expired timed session once after stale Resume', async () => {
    const user = userEvent.setup()
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-stale-expired',
      subjectId: '',
      startedAt: new Date(Date.now() - ACTIVE_FOCUS_SESSION_STALE_AFTER_MS - 60_000).toISOString(),
      plannedMinutes: 25,
      status: 'running',
    }))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Resume session' }))

    await waitFor(async () => {
      expect(await studyDb.studySessions.count()).toBe(1)
      expect(await getActiveFocusSession()).toBeNull()
    })
    expect(screen.getByText(/Session complete: \d+m logged/)).toBeInTheDocument()
    expect((await studyDb.studySessions.toArray())[0].id).toBe('focus-stale-expired')
  })

  it('discards a stale session without creating study history and re-enables Start', async () => {
    const user = userEvent.setup()
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-stale-discard',
      subjectId: '',
      startedAt: new Date(Date.now() - ACTIVE_FOCUS_SESSION_STALE_AFTER_MS).toISOString(),
      plannedMinutes: 25,
    }))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Discard session' }))

    expect(await screen.findByText('Unfinished focus session discarded.')).toBeInTheDocument()
    await waitForFocusStartEnabled()
    expect(await getActiveFocusSession()).toBeNull()
    expect(await studyDb.studySessions.count()).toBe(0)
  })

  it('keeps the stale decision recoverable when discard persistence fails', async () => {
    const user = userEvent.setup()
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-stale-fail',
      subjectId: '',
      startedAt: new Date(Date.now() - ACTIVE_FOCUS_SESSION_STALE_AFTER_MS).toISOString(),
      plannedMinutes: 0,
    }))
    const activeFocusApi = await import('./db/activeFocusSession')
    vi.spyOn(activeFocusApi, 'discardActiveFocusSession').mockRejectedValueOnce(new Error('write failed'))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Discard session' }))

    expect(await screen.findByText('Could not discard the unfinished focus session. Try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume session' })).toBeInTheDocument()
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-stale-fail' })
  })

  it('ignores a second discard click while a stale discard is already pending', async () => {
    let releaseDiscard: (value: Awaited<ReturnType<typeof discardActiveFocusSession>>) => void = () => {}
    const discardGate = new Promise<Awaited<ReturnType<typeof discardActiveFocusSession>>>((resolve) => {
      releaseDiscard = resolve
    })
    const activeFocusApi = await import('./db/activeFocusSession')
    vi.spyOn(activeFocusApi, 'discardActiveFocusSession').mockImplementation(() => discardGate)

    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-stale-double',
      subjectId: '',
      startedAt: new Date(Date.now() - ACTIVE_FOCUS_SESSION_STALE_AFTER_MS).toISOString(),
      plannedMinutes: 0,
    }))

    const user = userEvent.setup()
    render(<App />)
    const discardButton = await screen.findByRole('button', { name: 'Discard session' })
    await user.click(discardButton)
    await waitFor(() => expect(discardButton).toBeDisabled())
    await user.click(discardButton)

    expect(activeFocusApi.discardActiveFocusSession).toHaveBeenCalledTimes(1)
    releaseDiscard({ ok: true })
    expect(await screen.findByText('Unfinished focus session discarded.')).toBeInTheDocument()
  })

  it('synchronizes elapsed and remaining display immediately on resume after a long pause', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    const startedAt = new Date('2026-07-21T12:00:00.000Z')
    vi.setSystemTime(startedAt)

    await createActiveFocusSession({
      id: 'focus-clock-sync',
      subjectId: '',
      startedAt: startedAt.toISOString(),
      plannedMinutes: 25,
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: 0,
    })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000)
    })
    expect(screen.getByText('Elapsed').parentElement?.querySelector('strong')?.textContent).toBe('05:00')

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument()
    expect(screen.getByText('paused')).toBeInTheDocument()
    expect(screen.getByText('Elapsed').parentElement?.querySelector('strong')?.textContent).toBe('05:00')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000)
    })
    // Still frozen while paused even though wall time advanced 10 minutes.
    expect(screen.getByText('Elapsed').parentElement?.querySelector('strong')?.textContent).toBe('05:00')

    await user.click(screen.getByRole('button', { name: 'Resume' }))
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument()

    // Flush the immediate clock sync timeout without advancing the one-second interval.
    await act(async () => {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0)
      })
    })

    // Must be correct before the next interval tick (do not advance fake intervals here).
    expect(screen.getByText('Elapsed').parentElement?.querySelector('strong')?.textContent).toBe('05:00')
    expect(screen.getByText('remaining')).toBeInTheDocument()
    const ringValue = screen.getByText('remaining').previousElementSibling?.textContent
    expect(ringValue).toBe('20:00')
    expect(await getActiveFocusSession()).toMatchObject({
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: 10 * 60_000,
    })
  })

  it('toggles flashcard reveal', async () => {
    // Put data to trigger callbacks for settings and flashcards
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 120 })
    await studyDb.settings.put({ key: 'quickNotes', value: ['Note'] })
    await studyDb.subjects.add({ id: 'subj1', name: 'Math', progress: 0, color: '#000000', targetHours: 1, createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' })
    await studyDb.flashcards.add({ id: 'fc1', subjectId: 'subj1', front: 'Q', back: 'A', status: 'new', dueAt: new Date().toISOString(), lastReviewedAt: '', createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' })

    render(<App />)
    await screen.findByRole('heading', { name: 'Good morning' })

    // Reveal flashcard
    fireEvent.click(screen.getByRole('button', { name: 'Flashcards' }))
    const flashcardTitle = await screen.findByText('Q')
    expect(flashcardTitle).toBeInTheDocument()

    const revealBtn = screen.getByRole('button', { name: 'Reveal' })
    fireEvent.click(revealBtn)

    const hideBtn = screen.getByRole('button', { name: 'Hide' })
    fireEvent.click(hideBtn)
  })

  it('clears search when no results are found', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Good morning' })

    // Navigate to tasks
    await user.click(screen.getByRole('button', { name: 'Tasks' }))

    // Search for something that doesn't exist
    const searchInput = screen.getByPlaceholderText('Search')
    await user.type(searchInput, 'nonexistentterm')

    // Click the "Clear search" button that appears in the empty state
    // We should have multiple clear search buttons since we are in a view, let's just click the one in the main area if possible, or any.
    // The Topbar has one, and the empty state has one. The empty state one is usually what users click when there's no results.
    const clearButtons = screen.getAllByRole('button', { name: 'Clear search' })
    await user.click(clearButtons[clearButtons.length - 1])

    expect(searchInput).toHaveValue('')
  })

  it('navigates to Calendar from Upcoming widget', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Good morning' })

    const rightColumn = screen.getByRole('complementary', { name: 'Progress and schedule' })
    const viewAllBtn = within(rightColumn).getByRole('button', { name: 'View all' })
    await user.click(viewAllBtn)

    // Confirm Calendar view is open by looking for its unique action button
    expect(await screen.findByRole('button', { name: 'New event' })).toBeInTheDocument()
  })

  it('navigates to Flashcards from Review Queue widget', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Good morning' })

    const rightColumn = screen.getByRole('complementary', { name: 'Progress and schedule' })
    const reviewCardsBtn = within(rightColumn).getByRole('button', { name: 'Review cards' })
    await user.click(reviewCardsBtn)

    // Confirm Flashcards view is open by looking for its unique action button
    expect(await screen.findByRole('button', { name: 'New card' })).toBeInTheDocument()
  })
})

const FIRST_STUDY_TIMESTAMP = '2026-07-13T08:00:00.000Z'

async function addFirstStudySubject() {
  await studyDb.subjects.add({
    id: 'first-study-subject',
    name: 'Physics',
    color: '#2563eb',
    targetHours: 2,
    progress: 0,
    createdAt: FIRST_STUDY_TIMESTAMP,
    updatedAt: FIRST_STUDY_TIMESTAMP,
  })
}

async function addFirstStudyEvent() {
  await studyDb.events.add({
    id: 'first-study-event',
    title: 'Practice block',
    subjectId: 'first-study-subject',
    startAt: '2026-07-14T08:00:00.000Z',
    endAt: '2026-07-14T09:00:00.000Z',
    location: '',
    createdAt: FIRST_STUDY_TIMESTAMP,
    updatedAt: FIRST_STUDY_TIMESTAMP,
  })
}

async function addFirstStudySession() {
  await studyDb.studySessions.add({
    id: 'first-study-session',
    subjectId: 'first-study-subject',
    startedAt: '2026-07-13T08:00:00.000Z',
    endedAt: '2026-07-13T08:30:00.000Z',
    minutes: 30,
    note: 'First study loop',
  })
}
