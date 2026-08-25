import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { LIVE_READ_ERROR_MESSAGE } from './components/AppLiveReadFallback'
import * as subjectRead from './db/subjectRead'
import * as noteRead from './db/noteRead'
import * as taskRead from './db/taskRead'
import * as calendarEventRead from './db/calendarEventRead'
import * as studySessionRead from './db/studySessionRead'
import * as uiSettingsRead from './db/uiSettingsRead'
import {
  ACTIVE_FOCUS_SESSION_KEY,
  createActiveFocusSession,
  getActiveFocusSession,
} from './db/activeFocusSession'
import { studyDb } from './db/studyDb'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'
import { makeDurableFocusSession } from './test/focusTestHelpers'
import { pathForView } from './navigation/viewRoutes'

function silenceBoundaryConsole() {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
}

const readerModules = [
  { name: 'Subjects', spy: () => vi.spyOn(subjectRead, 'listSubjects') },
  { name: 'Notes', spy: () => vi.spyOn(noteRead, 'listNotes') },
  { name: 'Tasks', spy: () => vi.spyOn(taskRead, 'listTasks') },
  { name: 'Events', spy: () => vi.spyOn(calendarEventRead, 'listCalendarEvents') },
  { name: 'Study sessions', spy: () => vi.spyOn(studySessionRead, 'listStudySessions') },
  { name: 'UI settings', spy: () => vi.spyOn(uiSettingsRead, 'getUiSettings') },
] as const

describe('App live-read recovery', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it.each(readerModules)('shows recoverable alert when $name reader rejects initially', async ({ name, spy }) => {
    silenceBoundaryConsole()
    spy().mockRejectedValue(new Error(`${name} boom`))

    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(LIVE_READ_ERROR_MESSAGE)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(window.location.pathname).toBe(pathForView('Home'))
    expect(screen.queryByRole('heading', { name: /Good (morning|afternoon|evening)/ })).not.toBeInTheDocument()
  })

  it('keeps Settings backup recovery reachable while live reads remain failed', async () => {
    silenceBoundaryConsole()
    const user = userEvent.setup()
    vi.spyOn(subjectRead, 'listSubjects').mockRejectedValue(new Error('subjects unavailable'))

    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent(LIVE_READ_ERROR_MESSAGE)

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    expect(window.location.pathname).toBe(pathForView('Settings'))
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export data|Exporting backup/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show onboarding checklist' })).toBeInTheDocument()
    expect(screen.getByLabelText('Import data')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(LIVE_READ_ERROR_MESSAGE)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
  })

  it('retries through loading and restores the workspace when the reader recovers', async () => {
    silenceBoundaryConsole()
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-recover',
      name: 'Recovered subject',
      color: '#2563eb',
      targetHours: 2,
      progress: 10,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    let release!: (value: Awaited<ReturnType<typeof subjectRead.listSubjects>>) => void
    const gate = new Promise<Awaited<ReturnType<typeof subjectRead.listSubjects>>>((resolve) => {
      release = resolve
    })
    let shouldFail = true
    const subjectsSpy = vi.spyOn(subjectRead, 'listSubjects').mockImplementation(async () => {
      if (shouldFail) throw new Error('subjects unavailable')
      return gate
    })
    const tasksSpy = vi.spyOn(taskRead, 'listTasks')

    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent(LIVE_READ_ERROR_MESSAGE)
    const callsBeforeRetry = subjectsSpy.mock.calls.length
    const tasksBeforeRetry = tasksSpy.mock.calls.length

    shouldFail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Loading your study space...')).toBeInTheDocument()
    expect(screen.getByText('Loading your study space...')).toHaveAttribute('aria-live', 'polite')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    release(await studyDb.subjects.orderBy('createdAt').toArray())

    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(screen.getAllByText('Recovered subject').length).toBeGreaterThan(0)
    expect(subjectsSpy.mock.calls.length).toBeGreaterThan(callsBeforeRetry)
    expect(tasksSpy.mock.calls.length).toBeGreaterThan(tasksBeforeRetry)
    expect(await studyDb.subjects.get('subject-recover')).toMatchObject({ name: 'Recovered subject' })
  })

  it('returns to the same recoverable error state when Retry still fails', async () => {
    silenceBoundaryConsole()
    const user = userEvent.setup()
    const subjectsSpy = vi.spyOn(subjectRead, 'listSubjects').mockRejectedValue(new Error('subjects unavailable'))

    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent(LIVE_READ_ERROR_MESSAGE)
    const callsBeforeRetry = subjectsSpy.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(LIVE_READ_ERROR_MESSAGE)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
    expect(subjectsSpy.mock.calls.length).toBeGreaterThan(callsBeforeRetry)
    expect(screen.queryByRole('heading', { name: /Good (morning|afternoon|evening)/ })).not.toBeInTheDocument()
  })

  it('does not leak duplicate Subjects subscriptions across a successful Retry', async () => {
    silenceBoundaryConsole()
    const user = userEvent.setup()
    let shouldFail = true
    const subjectsSpy = vi.spyOn(subjectRead, 'listSubjects').mockImplementation(async () => {
      if (shouldFail) throw new Error('subjects unavailable')
      return studyDb.subjects.orderBy('createdAt').toArray()
    })

    render(<App />)
    await screen.findByRole('alert')
    shouldFail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })

    const callsAfterRecovery = subjectsSpy.mock.calls.length
    await studyDb.subjects.add({
      id: 'subject-after-retry',
      name: 'After retry',
      color: '#2563eb',
      targetHours: 1,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
    })

    await waitFor(() => expect(screen.getAllByText('After retry').length).toBeGreaterThan(0))
    await waitFor(() => expect(subjectsSpy.mock.calls.length).toBeGreaterThan(callsAfterRecovery))
    // One live subscription (StrictMode may double-invoke once): not a leaked second owner.
    expect(subjectsSpy.mock.calls.length - callsAfterRecovery).toBeLessThanOrEqual(2)
  })

  it('preserves durable focus across live-read failure and successful Retry', async () => {
    silenceBoundaryConsole()
    const user = userEvent.setup()
    const session = makeDurableFocusSession({
      id: 'focus-survive-read-error',
      subjectId: '',
      plannedMinutes: 25,
      status: 'running',
    })
    expect(await createActiveFocusSession(session, { expectedGeneration: 1 })).toMatchObject({ ok: true })

    let shouldFail = true
    vi.spyOn(subjectRead, 'listSubjects').mockImplementation(async () => {
      if (shouldFail) throw new Error('subjects unavailable')
      return []
    })

    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent(LIVE_READ_ERROR_MESSAGE)
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-survive-read-error', status: 'running' })
    expect((await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY))?.value).toMatchObject({
      id: 'focus-survive-read-error',
    })

    shouldFail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-survive-read-error', status: 'running' })
  })

  it('treats an empty successful Subjects result as loaded, not as an error', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
  })

  it('retains the active workspace URL while the read-error fallback is showing', async () => {
    silenceBoundaryConsole()
    const user = userEvent.setup()
    vi.spyOn(noteRead, 'listNotes').mockRejectedValue(new Error('notes unavailable'))

    window.history.replaceState(null, '', pathForView('Tasks'))
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent(LIVE_READ_ERROR_MESSAGE)
    expect(window.location.pathname).toBe(pathForView('Tasks'))
    expect(within(screen.getByRole('banner')).getByText('Tasks')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Notes' }))
    expect(window.location.pathname).toBe(pathForView('Notes'))
    expect(within(screen.getByRole('banner')).getByText('Notes')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(LIVE_READ_ERROR_MESSAGE)
  })

  it('initializes normally and renders dashboard when localStorage.getItem throws during preference read', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      const err = new Error('The operation is insecure.')
      err.name = 'SecurityError'
      throw err
    })

    render(<App />)
    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('monochrome')
  })
})
