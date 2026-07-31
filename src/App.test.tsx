import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { formatShortTime, toInputDate, toInputTime } from './appUtils'
import {
  ACTIVE_FOCUS_SESSION_KEY,
  ACTIVE_FOCUS_SESSION_STALE_AFTER_MS,
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

    await user.click(screen.getByLabelText('Edit Linear algebra drills'))
    await user.clear(screen.getByLabelText('Task title'))
    await user.type(screen.getByLabelText('Task title'), 'Matrix practice')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Matrix practice')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Toggle Matrix practice'))
    await waitFor(() => expect(screen.getByText('Matrix practice').closest('.list-row')).toHaveClass('is-done'))

    await user.type(screen.getByPlaceholderText('Search'), 'matrix')
    expect(screen.getByText('Matrix practice')).toBeInTheDocument()
    expect(screen.queryByText('Chemistry lab report')).not.toBeInTheDocument()

    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(screen.getByLabelText('Delete Matrix practice'))
    await waitFor(() => expect(screen.queryByText('Matrix practice')).not.toBeInTheDocument())
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

    expect(await screen.findByText(/Cannot delete Chemistry/)).toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()
    expect(await studyDb.subjects.get('subject-linked')).toBeDefined()
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

    expect(await screen.findByRole('status')).toHaveTextContent('Session logged.')
    const journal = screen.getByRole('region', { name: 'Study journal' })
    expect(within(journal).getByLabelText(/Physics, .*30m/)).toBeInTheDocument()
    expect(within(journal).getByText('Worked through momentum problems')).toBeInTheDocument()
    expect(within(screen.getByText('Weekly study').closest('article')! as HTMLElement).getByText('0h 30m')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(within(screen.getByLabelText('Today overview')).getByText('30m')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Subjects' }))
    expect(screen.getByRole('progressbar', { name: '50%' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Goals' }))
    expect(screen.getByRole('progressbar', { name: '30/60' })).toBeInTheDocument()

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
    expect(screen.getByRole('status')).toHaveTextContent('Session deleted.')
    expect(confirmDelete).toHaveBeenCalledWith(`Delete session from ${formatShortTime(start.toISOString())}? This cannot be undone.`)

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(within(screen.getByLabelText('Today overview')).getByText('0m')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Goals' }))
    expect(screen.getByRole('progressbar', { name: '0/60' })).toBeInTheDocument()
  })

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

    expect(await screen.findByRole('status')).toHaveTextContent('Session logged.')
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
    expect(await screen.findByRole('status')).toHaveTextContent('Session updated.')
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
    expect(screen.getByText('Answer hidden')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(screen.getByText('Power rule')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remembered' }))
    expect(await screen.findByText('remembered')).toBeInTheDocument()
    expect(await screen.findByText(/Next review/)).toBeInTheDocument()
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

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not clear study data. Try again.')

    // Ensure the dialog is closed and reset
    expect(screen.getByRole('button', { name: /Reset all study data/ })).toBeInTheDocument()

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
  })

  it('creates and manages goals', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Study 2 hours daily')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Study 2 hours daily')).toBeInTheDocument()

    const goals = await studyDb.goals.toArray()
    expect(goals).toHaveLength(1)
    expect(goals[0].title).toBe('Study 2 hours daily')
  })

  it('creates a new subject from the subjects view', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Subjects' }))
    await user.click(screen.getByRole('button', { name: 'New subject' }))
    await user.type(screen.getByLabelText('Subject name'), 'Physics')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Physics')).toBeInTheDocument()

    const subjects = await studyDb.subjects.toArray()
    expect(subjects).toHaveLength(1)
    expect(subjects[0].name).toBe('Physics')
  })

  it('saves quick notes from the home page', async () => {
    render(<App />)

    const textarea = await screen.findByPlaceholderText(/Capture fast ideas/i)
    fireEvent.change(textarea, { target: { value: 'Review chapter 5 for exam' } })
    expect(screen.getByText('Saving…')).toBeInTheDocument()

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
    await user.click(noticesBtn)

    const popover = screen.getByRole('status')
    expect(popover).toBeInTheDocument()
    expect(within(popover).getByText(/completed tasks/)).toBeInTheDocument()

    await user.click(noticesBtn)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
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
        return { click: clickMock, setAttribute: vi.fn() } as unknown as HTMLElement
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

    createElementSpy.mockRestore()
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
    vi.spyOn(await import('./db/activeFocusSession'), 'finalizeActiveFocusSession').mockRejectedValueOnce(new Error('write failed'))

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop session' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop session' })).toBeInTheDocument())
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-fail-finalize' })
    expect(await studyDb.studySessions.count()).toBe(0)
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
