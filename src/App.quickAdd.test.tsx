import { StrictMode, act } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { studyDb } from './db/studyDb'
import { createNote } from './db/notesService'
import {
  ACTIVE_FOCUS_SESSION_STALE_AFTER_MS,
  createActiveFocusSession,
  getActiveFocusSession,
  pauseActiveFocusSession,
} from './db/activeFocusSession'
import { pathForView } from './navigation/viewRoutes'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'
import { makeDurableFocusSession, waitForFocusStartEnabled } from './test/focusTestHelpers'

async function openQuickAddItem(
  user: ReturnType<typeof userEvent.setup>,
  label: 'Task' | 'Note' | 'Event' | 'Focus session',
) {
  await user.click(await screen.findByRole('button', { name: 'Quick add' }))
  await user.click(within(screen.getByRole('menu', { name: 'Quick add' })).getByRole('menuitem', { name: label }))
}

async function waitForFocusAttention(name: string | RegExp) {
  await waitFor(() => {
    expect(screen.getByRole('button', { name })).toHaveFocus()
  })
}

describe('App quick add', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('opens Task create from another route and while already on Tasks', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await openQuickAddItem(user, 'Task')
    expect(await screen.findByLabelText('Task title')).toBeInTheDocument()
    expect(window.location.pathname).toBe(pathForView('Tasks'))
    expect(await studyDb.tasks.count()).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await openQuickAddItem(user, 'Task')
    expect(await screen.findByLabelText('Task title')).toBeInTheDocument()
    expect(window.location.pathname).toBe(pathForView('Tasks'))
  })

  it('opens Note create, repeats after close, and does not create until submit', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openQuickAddItem(user, 'Note')
    expect(await screen.findByLabelText('Note title')).toBeInTheDocument()
    expect(window.location.pathname).toBe(pathForView('Notes'))
    expect(await studyDb.notes.count()).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Note title')).not.toBeInTheDocument()

    await openQuickAddItem(user, 'Note')
    expect(await screen.findByLabelText('Note title')).toBeInTheDocument()
  })

  it('opens Event create with local-date defaults and supports cancel/repeat', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openQuickAddItem(user, 'Event')
    expect(await screen.findByLabelText('Event title')).toBeInTheDocument()
    expect(window.location.pathname).toBe(pathForView('Calendar'))
    const today = new Date()
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect(screen.getByLabelText('Date')).toHaveValue(localDate)
    expect(await studyDb.events.count()).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await openQuickAddItem(user, 'Event')
    expect(await screen.findByLabelText('Event title')).toBeInTheDocument()
  })

  it('navigates from Tasks to Home and focuses Start without starting a session', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()

    await openQuickAddItem(user, 'Focus session')
    expect(window.location.pathname).toBe(pathForView('Home'))
    await waitForFocusAttention('Start focus')
    expect(await getActiveFocusSession()).toBeNull()
    expect(await studyDb.studySessions.count()).toBe(0)
  })

  it('focuses Start while already on Home and supports repeated Focus requests', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await openQuickAddItem(user, 'Focus session')
    await waitForFocusAttention('Start focus')

    screen.getByRole('button', { name: 'Quick add' }).focus()
    await openQuickAddItem(user, 'Focus session')
    await waitForFocusAttention('Start focus')
    expect(await getActiveFocusSession()).toBeNull()
  })

  it('reveals a running session without pausing or stopping it', async () => {
    const user = userEvent.setup()
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-quick-running',
      subjectId: '',
      plannedMinutes: 0,
      status: 'running',
    }))
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    await openQuickAddItem(user, 'Focus session')
    await waitForFocusAttention('Pause')
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-quick-running', status: 'running' })
    expect(await studyDb.studySessions.count()).toBe(0)
  })

  it('reveals a paused session without resuming it', async () => {
    const user = userEvent.setup()
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-quick-paused',
      subjectId: '',
      plannedMinutes: 0,
      status: 'paused',
      pausedAt: new Date().toISOString(),
      accumulatedPausedMs: 30_000,
    }))
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Notes' }))
    await openQuickAddItem(user, 'Focus session')
    await waitForFocusAttention('Resume')
    expect(await getActiveFocusSession()).toMatchObject({
      id: 'focus-quick-paused',
      status: 'paused',
      accumulatedPausedMs: 30_000,
    })
  })

  it('reveals stale recovery UI without discarding or finalizing', async () => {
    const user = userEvent.setup()
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-quick-stale',
      subjectId: '',
      startedAt: new Date(Date.now() - ACTIVE_FOCUS_SESSION_STALE_AFTER_MS).toISOString(),
      plannedMinutes: 25,
      status: 'running',
    }))
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    await openQuickAddItem(user, 'Focus session')
    await waitForFocusAttention('Resume session')
    expect(screen.getByRole('heading', { name: 'Unfinished focus session' })).toBeInTheDocument()
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-quick-stale', status: 'running' })
    expect(await studyDb.studySessions.count()).toBe(0)
  })

  it('does not duplicate a pending pause when Focus quick-add runs', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitForFocusStartEnabled()
    await user.click(screen.getByRole('button', { name: 'Start focus' }))
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument()

    let releasePause!: () => void
    const pauseGate = new Promise<void>((resolve) => {
      releasePause = resolve
    })
    const pauseModule = await import('./db/activeFocusSession')
    const pauseSpy = vi.spyOn(pauseModule, 'pauseActiveFocusSession').mockImplementation(async (...args) => {
      await pauseGate
      pauseSpy.mockRestore()
      return pauseActiveFocusSession(...args)
    })

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    await openQuickAddItem(user, 'Focus session')
    await waitFor(() => {
      expect(document.getElementById('home-focus-session')).not.toBeNull()
    })
    expect(pauseSpy).toHaveBeenCalledTimes(1)
    expect(await getActiveFocusSession()).toMatchObject({ status: 'running' })

    releasePause()
    await waitFor(async () => {
      expect(await getActiveFocusSession()).toMatchObject({ status: 'paused' })
    })
  })

  it('does not replay Focus attention after popstate Back/Forward', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openQuickAddItem(user, 'Focus session')
    await waitForFocusAttention('Start focus')

    await user.click(screen.getByRole('button', { name: 'Tasks' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()

    act(() => {
      window.history.back()
    })
    await waitFor(() => {
      expect(window.location.pathname).toBe(pathForView('Home'))
      expect(screen.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Start focus' })).not.toHaveFocus()

    act(() => {
      window.history.forward()
    })
    await waitFor(() => {
      expect(window.location.pathname).toBe(pathForView('Tasks'))
    })
  })

  it('keeps entity create intents isolated from Focus attention', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openQuickAddItem(user, 'Task')
    expect(await screen.findByLabelText('Task title')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start focus' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await openQuickAddItem(user, 'Focus session')
    await waitForFocusAttention('Start focus')
    expect(screen.queryByLabelText('Task title')).not.toBeInTheDocument()
  })

  it('shares the dashboard recommendation attention path with Quick add', async () => {
    const user = userEvent.setup()
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-shared-path',
      subjectId: '',
      plannedMinutes: 0,
      status: 'running',
    }))
    render(<App />)

    const today = (await screen.findByRole('heading', { name: 'Today' })).closest('section') as HTMLElement
    await user.click(within(today).getByRole('button', { name: 'Go to focus' }))
    expect(screen.getByRole('button', { name: 'Pause' })).toHaveFocus()

    screen.getByRole('button', { name: 'Quick add' }).focus()
    await openQuickAddItem(user, 'Focus session')
    await waitForFocusAttention('Pause')
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-shared-path', status: 'running' })
  })

  it('does not leave a Focus attention replay after ordinary Home return', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openQuickAddItem(user, 'Focus session')
    await waitForFocusAttention('Start focus')

    await user.click(screen.getByRole('button', { name: 'Tasks' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('button', { name: 'Start focus' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start focus' })).not.toHaveFocus()
  })

  it('consumes retained Focus attention once after live-read Retry without looping', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()
    const subjectRead = await import('./db/subjectRead')
    let shouldFail = true
    vi.spyOn(subjectRead, 'listSubjects').mockImplementation(async () => {
      if (shouldFail) throw new Error('subjects unavailable')
      return studyDb.subjects.orderBy('createdAt').toArray()
    })

    render(<App />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await openQuickAddItem(user, 'Focus session')
    expect(window.location.pathname).toBe(pathForView('Home'))
    expect(screen.queryByRole('button', { name: 'Start focus' })).not.toBeInTheDocument()

    shouldFail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitForFocusAttention('Start focus')

    await user.click(screen.getByRole('button', { name: 'Tasks' }))
    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('button', { name: 'Start focus' })).not.toHaveFocus()
  })

  it('does not replay stale create intents after popstate Back/Forward', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openQuickAddItem(user, 'Note')
    expect(await screen.findByLabelText('Note title')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: 'Tasks' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()

    act(() => {
      window.history.back()
    })
    await waitFor(() => {
      expect(window.location.pathname).toBe(pathForView('Notes'))
      expect(screen.getByRole('heading', { level: 1, name: 'Notes' })).toBeInTheDocument()
    })
    expect(screen.queryByLabelText('Note title')).not.toBeInTheDocument()

    act(() => {
      window.history.forward()
    })
    await waitFor(() => {
      expect(window.location.pathname).toBe(pathForView('Tasks'))
    })
    expect(screen.queryByLabelText('Task title')).not.toBeInTheDocument()
  })

  it('matches workspace New draft replacement when an edit editor is already open', async () => {
    const user = userEvent.setup()
    await createNote({
      title: 'Existing note',
      body: 'Keep me until New replaces',
      subjectId: '',
      tags: [],
    })
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Notes' }))
    await user.click(await screen.findByRole('button', { name: 'Edit Existing note' }))
    expect(await screen.findByLabelText('Note title')).toHaveValue('Existing note')

    await openQuickAddItem(user, 'Note')
    expect(await screen.findByLabelText('Note title')).toHaveValue('')
    expect(screen.getByLabelText('Body')).toHaveValue('')
  })

  it('does not open the create editor twice under StrictMode', async () => {
    const user = userEvent.setup()
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    await openQuickAddItem(user, 'Task')
    expect(await screen.findAllByLabelText('Task title')).toHaveLength(1)
  })

  it('does not call Dexie write paths from menu selection alone', async () => {
    const user = userEvent.setup()
    const bulkAdd = vi.spyOn(studyDb.tasks, 'bulkAdd')
    const add = vi.spyOn(studyDb.tasks, 'add')
    render(<App />)

    await openQuickAddItem(user, 'Task')
    expect(await screen.findByLabelText('Task title')).toBeInTheDocument()
    expect(bulkAdd).not.toHaveBeenCalled()
    expect(add).not.toHaveBeenCalled()
  })
})
