import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as appShellRead from './db/appShellRead'
import * as calendarEventRead from './db/calendarEventRead'
import { createCalendarEvent } from './db/calendarEventService'
import * as flashcardRead from './db/flashcardRead'
import { createFlashcard } from './db/flashcardService'
import * as goalRead from './db/goalRead'
import { createGoal } from './db/goalService'
import { createNote } from './db/notesService'
import * as noteRead from './db/noteRead'
import * as taskRead from './db/taskRead'
import { createTask } from './db/taskService'
import { saveQuickNotes } from './db/quickNotesService'
import * as studySessionRead from './db/studySessionRead'
import {
  createStudySession,
  deleteStudySession,
  updateStudySession,
} from './db/studySessionService'
import { createSubject } from './db/subjectService'
import {
  createActiveFocusSession,
  getActiveFocusSession,
} from './db/activeFocusSession'
import { exportStudyData, getStudyData, studyDb } from './db/studyDb'
import { getMillisecondsUntilNextLocalMidnight } from './hooks/useCurrentDate'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'
import { makeDurableFocusSession, waitForFocusStartEnabled } from './test/focusTestHelpers'
import { toInputDate, toInputTime } from './appUtils'

describe('App study sessions live query isolation', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
    vi.useRealTimers()
  })

  it('reruns Sessions without rerunning the App shell for manual journal writes and updates consumers', async () => {
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-sessions',
      name: 'Physics',
      color: '#2563eb',
      targetHours: 1,
      progress: 0,
      progressMode: 'study_time',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    const shellSpy = vi.spyOn(appShellRead, 'getAppShellData')
    const sessionsSpy = vi.spyOn(studySessionRead, 'listStudySessions')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(sessionsSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const sessionsBefore = sessionsSpy.mock.calls.length

    const start = new Date()
    start.setHours(start.getHours() - 2, 0, 0, 0)

    await user.click(screen.getByRole('button', { name: 'Progress' }))
    await user.click(screen.getByRole('button', { name: 'Log session' }))
    await user.selectOptions(await screen.findByLabelText('Subject'), 'subject-sessions')
    await user.clear(screen.getByLabelText('Date'))
    await user.type(screen.getByLabelText('Date'), toInputDate(start))
    await user.clear(screen.getByLabelText('Start time'))
    await user.type(screen.getByLabelText('Start time'), toInputTime(start))
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '30')
    await user.click(screen.getByRole('button', { name: 'Save session' }))

    expect(await screen.findByText(/1 session logged/i)).toBeInTheDocument()
    await waitFor(() => expect(sessionsSpy.mock.calls.length).toBeGreaterThan(sessionsBefore))
    expect(shellSpy.mock.calls.length).toBe(shellBefore)

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(within(screen.getByLabelText('Today overview')).getByText('30m')).toBeInTheDocument()
    expect(screen.getByLabelText('First study loop progress')).toHaveAttribute('aria-valuenow', '2')

    await user.click(screen.getByRole('button', { name: 'Subjects' }))
    const subjectCard = (await screen.findByText('Physics')).closest('article') as HTMLElement
    expect(within(subjectCard).getByText(/1 linked records/i)).toBeInTheDocument()
  })

  it('reruns Sessions and shell on focus finalization with one history row and UI refresh', async () => {
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-focus-hist',
      name: 'Chemistry',
      color: '#0f766e',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    const shellSpy = vi.spyOn(appShellRead, 'getAppShellData')
    const sessionsSpy = vi.spyOn(studySessionRead, 'listStudySessions')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(sessionsSpy).toHaveBeenCalled())

    await user.selectOptions(screen.getByLabelText('Focus subject'), 'subject-focus-hist')
    await waitForFocusStartEnabled()
    const shellBefore = shellSpy.mock.calls.length
    const sessionsBefore = sessionsSpy.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Start focus' }))
    expect(await screen.findByText('Elapsed')).toBeInTheDocument()
    await waitFor(() => expect(shellSpy.mock.calls.length).toBeGreaterThan(shellBefore))
    const shellAfterStart = shellSpy.mock.calls.length
    const sessionsAfterStart = sessionsSpy.mock.calls.length
    expect(sessionsAfterStart).toBe(sessionsBefore)

    await user.click(screen.getByRole('button', { name: 'Stop session' }))
    await waitFor(async () => {
      expect(await studyDb.studySessions.count()).toBe(1)
      expect(await getActiveFocusSession()).toBeNull()
    })
    await waitFor(() => expect(sessionsSpy.mock.calls.length).toBeGreaterThan(sessionsAfterStart))
    await waitFor(() => expect(shellSpy.mock.calls.length).toBeGreaterThan(shellAfterStart))
    expect(await screen.findByRole('button', { name: 'Start focus' })).toBeInTheDocument()
    expect(within(screen.getByLabelText('Today overview')).getByText(/focused today/i)).toBeInTheDocument()
  })

  it('does not rerun Sessions for settings-only Quick Notes writes', async () => {
    const shellSpy = vi.spyOn(appShellRead, 'getAppShellData')
    const sessionsSpy = vi.spyOn(studySessionRead, 'listStudySessions')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(sessionsSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const sessionsBefore = sessionsSpy.mock.calls.length

    await saveQuickNotes('Quick line one')

    await waitFor(() => expect(shellSpy.mock.calls.length).toBeGreaterThan(shellBefore))
    expect(sessionsSpy.mock.calls.length).toBe(sessionsBefore)
  })

  it('does not rerun Sessions for Subject writes that do rerun the App shell', async () => {
    const shellSpy = vi.spyOn(appShellRead, 'getAppShellData')
    const sessionsSpy = vi.spyOn(studySessionRead, 'listStudySessions')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(sessionsSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const sessionsBefore = sessionsSpy.mock.calls.length

    await createSubject({
      name: 'New subject only',
      color: '#2563eb',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
    })

    await waitFor(() => expect(shellSpy.mock.calls.length).toBeGreaterThan(shellBefore))
    expect(sessionsSpy.mock.calls.length).toBe(sessionsBefore)
  })

  it('does not rerun Sessions for Task, Note, Event, Flashcard, or Goal-only writes', async () => {
    const user = userEvent.setup()
    const sessionsSpy = vi.spyOn(studySessionRead, 'listStudySessions')
    const tasksSpy = vi.spyOn(taskRead, 'listTasks')
    const notesSpy = vi.spyOn(noteRead, 'listNotes')
    const eventsSpy = vi.spyOn(calendarEventRead, 'listCalendarEvents')
    const flashcardsSpy = vi.spyOn(flashcardRead, 'listFlashcards')
    const goalsSpy = vi.spyOn(goalRead, 'listGoals')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(sessionsSpy).toHaveBeenCalled())
    await waitFor(() => expect(tasksSpy).toHaveBeenCalled())
    const sessionsBaseline = sessionsSpy.mock.calls.length
    const tasksBefore = tasksSpy.mock.calls.length
    const notesBefore = notesSpy.mock.calls.length
    const eventsBefore = eventsSpy.mock.calls.length
    const flashcardsBefore = flashcardsSpy.mock.calls.length

    await createTask({
      title: 'Unrelated task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      minutes: 20,
    })
    await waitFor(() => expect(tasksSpy.mock.calls.length).toBeGreaterThan(tasksBefore))
    expect(sessionsSpy.mock.calls.length).toBe(sessionsBaseline)

    await createNote({
      title: 'Unrelated note',
      body: 'body',
      subjectId: '',
      tags: [],
    })
    await waitFor(() => expect(notesSpy.mock.calls.length).toBeGreaterThan(notesBefore))
    expect(sessionsSpy.mock.calls.length).toBe(sessionsBaseline)

    await createCalendarEvent({
      title: 'Unrelated event',
      subjectId: '',
      startAt: '2026-07-10T10:00:00.000Z',
      endAt: '2026-07-10T11:00:00.000Z',
      location: '',
    })
    await waitFor(() => expect(eventsSpy.mock.calls.length).toBeGreaterThan(eventsBefore))
    expect(sessionsSpy.mock.calls.length).toBe(sessionsBaseline)

    await createFlashcard({
      front: 'Unrelated card',
      back: 'answer',
      subjectId: '',
    })
    await waitFor(() => expect(flashcardsSpy.mock.calls.length).toBeGreaterThan(flashcardsBefore))
    expect(sessionsSpy.mock.calls.length).toBe(sessionsBaseline)

    await user.click(screen.getByRole('button', { name: 'Goals' }))
    await screen.findByRole('heading', { name: 'Goals' })
    await waitFor(() => expect(goalsSpy).toHaveBeenCalled())
    const goalsBefore = goalsSpy.mock.calls.length
    const sessionsBeforeGoal = sessionsSpy.mock.calls.length

    await createGoal({
      title: 'Manual goal only',
      target: 30,
      progress: 0,
      period: 'weekly',
      metric: 'manual',
    })
    await waitFor(() => expect(goalsSpy.mock.calls.length).toBeGreaterThan(goalsBefore))
    expect(sessionsSpy.mock.calls.length).toBe(sessionsBeforeGoal)
  })

  it('refreshes Sessions after Dexie clear and restore without a page reload', async () => {
    const user = userEvent.setup()
    const created = await createStudySession({
      subjectId: '',
      startedAt: '2026-07-02T09:00:00.000Z',
      endedAt: '2026-07-02T09:30:00.000Z',
      minutes: 30,
      note: 'Restore me',
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    expect(await screen.findByText(/1 session logged/i)).toBeInTheDocument()

    const snapshot = await exportStudyData()
    expect(snapshot.studySessions.map((session) => session.note)).toContain('Restore me')

    await studyDb.studySessions.clear()
    await waitFor(() => expect(screen.getByText(/0 sessions logged/i)).toBeInTheDocument())

    await studyDb.studySessions.bulkPut(snapshot.studySessions)
    expect(await screen.findByText(/1 session logged/i)).toBeInTheDocument()
    expect(created.id).toBe(snapshot.studySessions[0]?.id)
  })

  it('keeps full getStudyData / export snapshots including Sessions', async () => {
    await createStudySession({
      subjectId: '',
      startedAt: '2026-07-02T09:00:00.000Z',
      endedAt: '2026-07-02T09:40:00.000Z',
      minutes: 40,
      note: 'Export session',
    })
    const full = await getStudyData()
    const exported = await exportStudyData()
    expect(full.studySessions).toHaveLength(1)
    expect(full.studySessions[0]?.note).toBe('Export session')
    expect(exported.studySessions).toEqual(full.studySessions)
    expect(exported.version).toBe(3)
  })

  it('updates Sessions after edit and delete without shell Sessions reads', async () => {
    const created = await createStudySession({
      subjectId: '',
      startedAt: '2026-07-02T09:00:00.000Z',
      endedAt: '2026-07-02T09:20:00.000Z',
      minutes: 20,
      note: 'Mutate me',
    })

    const user = userEvent.setup()
    const shellSpy = vi.spyOn(appShellRead, 'getAppShellData')
    const sessionsSpy = vi.spyOn(studySessionRead, 'listStudySessions')

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    expect(await screen.findByText(/1 session logged/i)).toBeInTheDocument()

    const shellBefore = shellSpy.mock.calls.length
    const sessionsBefore = sessionsSpy.mock.calls.length
    await updateStudySession(created.id, {
      subjectId: '',
      startedAt: created.startedAt,
      endedAt: '2026-07-02T09:45:00.000Z',
      minutes: 45,
      note: 'Mutate me updated',
    })

    await waitFor(() => expect(sessionsSpy.mock.calls.length).toBeGreaterThan(sessionsBefore))
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
    expect(await screen.findByText(/1 session logged/i)).toBeInTheDocument()

    await deleteStudySession(created.id)
    await waitFor(() => expect(screen.getByText(/0 sessions logged/i)).toBeInTheDocument())
  })

  it('recalculates App today metrics at midnight without rerunning listStudySessions', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const beforeMidnight = new Date(2026, 6, 13, 23, 0, 0, 0)
    vi.setSystemTime(beforeMidnight)

    const midnightCallbacks: Array<() => void> = []
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis)
    const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis)
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (typeof handler === 'function' && typeof delay === 'number' && delay >= 60_000) {
        midnightCallbacks.push(() => {
          handler(...args)
        })
        return 90_001 as unknown as ReturnType<typeof setTimeout>
      }
      return nativeSetTimeout(handler, delay, ...args)
    }) as typeof setTimeout)
    vi.spyOn(globalThis, 'clearTimeout').mockImplementation(((id?: number | NodeJS.Timeout) => {
      if (id === 90_001) return
      return nativeClearTimeout(id as Parameters<typeof nativeClearTimeout>[0])
    }) as typeof clearTimeout)

    await createStudySession({
      subjectId: '',
      startedAt: new Date(2026, 6, 13, 10, 0).toISOString(),
      endedAt: new Date(2026, 6, 13, 10, 30).toISOString(),
      minutes: 30,
      note: 'today before midnight',
    })

    const sessionsSpy = vi.spyOn(studySessionRead, 'listStudySessions')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(sessionsSpy).toHaveBeenCalled())
    expect(midnightCallbacks).toHaveLength(1)
    expect(getMillisecondsUntilNextLocalMidnight(beforeMidnight)).toBeGreaterThan(0)
    expect(within(screen.getByLabelText('Today overview')).getByText('30m')).toBeInTheDocument()

    const sessionsBefore = sessionsSpy.mock.calls.length
    const sessionCountBefore = await studyDb.studySessions.count()

    const afterMidnight = new Date(2026, 6, 14, 0, 0, 0, 0)
    vi.setSystemTime(afterMidnight)
    await act(async () => {
      midnightCallbacks[0]!()
    })

    expect(within(screen.getByLabelText('Today overview')).getByText('0m')).toBeInTheDocument()
    expect(sessionsSpy.mock.calls.length).toBe(sessionsBefore)
    expect(await studyDb.studySessions.count()).toBe(sessionCountBefore)
  })

  it('preserves Goals wall-clock asymmetry: midnight does not requery sessions for Goal cards', async () => {
    const user = userEvent.setup()
    vi.useFakeTimers({ toFake: ['Date'] })
    const beforeMidnight = new Date(2026, 6, 13, 23, 0, 0, 0)
    vi.setSystemTime(beforeMidnight)

    const midnightCallbacks: Array<() => void> = []
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis)
    const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis)
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (typeof handler === 'function' && typeof delay === 'number' && delay >= 60_000) {
        midnightCallbacks.push(() => {
          handler(...args)
        })
        return 90_002 as unknown as ReturnType<typeof setTimeout>
      }
      return nativeSetTimeout(handler, delay, ...args)
    }) as typeof setTimeout)
    vi.spyOn(globalThis, 'clearTimeout').mockImplementation(((id?: number | NodeJS.Timeout) => {
      if (id === 90_002) return
      return nativeClearTimeout(id as Parameters<typeof nativeClearTimeout>[0])
    }) as typeof clearTimeout)

    await createGoal({
      title: 'Daily study goal',
      target: 60,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
    })
    await createStudySession({
      subjectId: '',
      startedAt: new Date(2026, 6, 13, 10, 0).toISOString(),
      endedAt: new Date(2026, 6, 13, 10, 30).toISOString(),
      minutes: 30,
      note: '',
    })

    const sessionsSpy = vi.spyOn(studySessionRead, 'listStudySessions')

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    expect(await screen.findByText('30/60 minutes')).toBeInTheDocument()
    await waitFor(() => expect(sessionsSpy).toHaveBeenCalled())
    const sessionsBefore = sessionsSpy.mock.calls.length

    vi.setSystemTime(new Date(2026, 6, 14, 0, 0, 0, 0))
    await act(async () => {
      midnightCallbacks[0]!()
    })

    // Goals still use calculateGoalProgress(..., new Date()) without App currentDate —
    // preserving existing asymmetry: no sessions requery from midnight alone.
    expect(sessionsSpy.mock.calls.length).toBe(sessionsBefore)
  })

  it('focus finalize remains idempotent for matching history identity', async () => {
    const created = await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-idempotent',
      subjectId: '',
      plannedMinutes: 25,
      startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    }))
    expect(created).toMatchObject({ ok: true, session: { id: 'focus-idempotent' } })

    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Stop session' }))
    await waitFor(async () => {
      expect(await studyDb.studySessions.count()).toBe(1)
      expect(await getActiveFocusSession()).toBeNull()
    })
    expect((await studyDb.studySessions.toArray())[0]?.id).toBe('focus-idempotent')
  })
})
