import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  ACTIVE_FOCUS_SESSION_KEY,
  ACTIVE_FOCUS_SESSION_STALE_AFTER_MS,
  clearActiveFocusSession,
  createActiveFocusSession,
  discardActiveFocusSession,
  getActiveFocusSession,
  pauseActiveFocusSession,
} from './db/activeFocusSession'
import { studyDb } from './db/studyDb'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'
import { importStudyExport, makeEmptyExport } from './test/backupTestHelpers'
import { makeDurableFocusSession, waitForFocusStartEnabled } from './test/focusTestHelpers'

describe('App focus', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
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

  it('logs focus session automatically when time limit is reached', async () => {
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 120 })
    await studyDb.settings.put({ key: 'quickNotes', value: ['Test Note'] })
    await studyDb.subjects.add({ id: 'subj-cov', name: 'CovSubject', progress: 0, color: '#000000', targetHours: 1, createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' })
    await studyDb.flashcards.add({ id: 'fc-cov', subjectId: 'subj-cov', front: 'Q', back: 'A', status: 'new', dueAt: new Date().toISOString(), lastReviewedAt: '', createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' })

    const nearlyDone = makeDurableFocusSession({
      id: 'focus-auto-complete',
      subjectId: 'subj-cov',
      startedAt: new Date(Date.now() - (25 * 60_000 - 500)).toISOString(),
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
    const remainingMs = 500
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-timed-pause',
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
      await new Promise((resolve) => window.setTimeout(resolve, 120))
    })
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
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not pause the focus session. Try again.')

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
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not pause the focus session. Try again.')

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

  it('keeps the focus timer accessible without live-region second ticks', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    const startedAt = new Date('2026-07-21T12:00:00.000Z')
    vi.setSystemTime(startedAt)

    await createActiveFocusSession({
      id: 'focus-a11y-timer',
      subjectId: '',
      startedAt: startedAt.toISOString(),
      plannedMinutes: 25,
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: 0,
    })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)

    const focusCard = await screen.findByRole('region', { name: 'Focus session' })
    expect(within(focusCard).getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(within(focusCard).getByText('remaining')).toBeInTheDocument()

    const elapsed = within(focusCard).getByText('Elapsed').closest('.session-elapsed')
    expect(elapsed).not.toBeNull()
    expect(elapsed).not.toHaveAttribute('aria-live')
    expect(elapsed).not.toHaveAttribute('aria-atomic')
    expect(elapsed).not.toHaveAttribute('aria-hidden')
    expect(elapsed).not.toHaveAttribute('role')
    expect(within(elapsed as HTMLElement).getByText('00:00')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })
    expect(within(elapsed as HTMLElement).getByText('00:02')).toBeInTheDocument()
    expect(elapsed).not.toHaveAttribute('aria-live')

    await user.click(within(focusCard).getByRole('button', { name: 'Pause' }))
    expect(await within(focusCard).findByRole('button', { name: 'Resume' })).toBeInTheDocument()
    expect(within(focusCard).getByText('paused')).toBeInTheDocument()
    expect(within(elapsed as HTMLElement).getByText('00:02')).toBeInTheDocument()
    expect(elapsed).not.toHaveAttribute('aria-live')

    await user.click(within(focusCard).getByRole('button', { name: 'Resume' }))
    expect(await within(focusCard).findByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(within(focusCard).getByText('remaining')).toBeInTheDocument()
    expect(document.querySelector('.session-elapsed')).toBeInTheDocument()
    expect(document.querySelector('.session-elapsed')).not.toHaveAttribute('aria-live')

    await user.click(within(focusCard).getByRole('button', { name: 'Stop session' }))
    const stopNotice = await screen.findByText(/Session stopped:/i)
    expect(stopNotice).toHaveAttribute('role', 'status')
    expect(screen.queryByText('Elapsed')).not.toBeInTheDocument()
  })

  it('keeps open-ended focus elapsed text visible without live announcements', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    const startedAt = new Date('2026-07-21T12:00:00.000Z')
    vi.setSystemTime(startedAt)

    await createActiveFocusSession({
      id: 'focus-a11y-open-ended',
      subjectId: '',
      startedAt: startedAt.toISOString(),
      plannedMinutes: 0,
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: 0,
    })

    render(<App />)

    const focusCard = await screen.findByRole('region', { name: 'Focus session' })
    expect(within(focusCard).getByText('elapsed')).toBeInTheDocument()
    const elapsed = within(focusCard).getByText('Elapsed').closest('.session-elapsed')
    expect(elapsed).not.toHaveAttribute('aria-live')
    expect(within(elapsed as HTMLElement).getByText('00:00')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })
    expect(within(elapsed as HTMLElement).getByText('00:03')).toBeInTheDocument()
    expect(elapsed).not.toHaveAttribute('aria-live')
    expect(elapsed).not.toHaveAttribute('aria-hidden')
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
})
