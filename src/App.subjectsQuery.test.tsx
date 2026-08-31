import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as subjectRead from './db/subjectRead'
import * as calendarEventRead from './db/calendarEventRead'
import { createCalendarEvent } from './db/calendarEventService'
import * as goalRead from './db/goalRead'
import { createGoal } from './db/goalService'
import { createNote } from './db/notesService'
import * as noteRead from './db/noteRead'
import * as taskRead from './db/taskRead'
import { createTask } from './db/taskService'
import * as studySessionRead from './db/studySessionRead'
import { createStudySession } from './db/studySessionService'
import {
  createSubject,
  deleteSubject,
  updateSubject,
} from './db/subjectService'
import * as uiSettingsRead from './db/uiSettingsRead'
import {
  ACTIVE_FOCUS_SESSION_KEY,
  ACTIVE_FOCUS_SESSION_STALE_AFTER_MS,
  createActiveFocusSession,
  finalizeActiveFocusSession,
  getActiveFocusSession,
  pauseActiveFocusSession,
  resumeActiveFocusSession,
} from './db/activeFocusSession'
import { clearAllStudyData, exportStudyData, getStudyData, importStudyData, studyDb } from './db/studyDb'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'
import { makeDurableFocusSession, waitForFocusStartEnabled } from './test/focusTestHelpers'
import { makeEmptyExport } from './test/backupTestHelpers'

describe('App subjects live query isolation', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('reruns Subjects for create/update/delete without unrelated entity or UI-settings queries', async () => {
    const subjectsSpy = vi.spyOn(subjectRead, 'listSubjects')
    const tasksSpy = vi.spyOn(taskRead, 'listTasks')
    const notesSpy = vi.spyOn(noteRead, 'listNotes')
    const eventsSpy = vi.spyOn(calendarEventRead, 'listCalendarEvents')
    const sessionsSpy = vi.spyOn(studySessionRead, 'listStudySessions')
    const uiSpy = vi.spyOn(uiSettingsRead, 'getUiSettings')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(subjectsSpy).toHaveBeenCalled())
    await waitFor(() => expect(tasksSpy).toHaveBeenCalled())
    await waitFor(() => expect(uiSpy).toHaveBeenCalled())

    const subjectsBeforeCreate = subjectsSpy.mock.calls.length
    const tasksBefore = tasksSpy.mock.calls.length
    const notesBefore = notesSpy.mock.calls.length
    const eventsBefore = eventsSpy.mock.calls.length
    const sessionsBefore = sessionsSpy.mock.calls.length
    const uiBefore = uiSpy.mock.calls.length

    const created = await createSubject({
      name: 'Isolation subject',
      color: '#2563eb',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
    }, { expectedGeneration: 1 })

    await waitFor(() => expect(subjectsSpy.mock.calls.length).toBeGreaterThan(subjectsBeforeCreate))
    expect(tasksSpy.mock.calls.length).toBe(tasksBefore)
    expect(notesSpy.mock.calls.length).toBe(notesBefore)
    expect(eventsSpy.mock.calls.length).toBe(eventsBefore)
    expect(sessionsSpy.mock.calls.length).toBe(sessionsBefore)
    expect(uiSpy.mock.calls.length).toBe(uiBefore)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Subjects' }))
    expect(await screen.findByText('Isolation subject')).toBeInTheDocument()

    const subjectsBeforeUpdate = subjectsSpy.mock.calls.length
    await updateSubject(created.id, {
      name: 'Isolation subject renamed',
      color: '#0f766e',
      targetHours: 3,
      progress: 10,
      progressMode: 'manual',
    }, { expectedGeneration: 1 })
    await waitFor(() => expect(subjectsSpy.mock.calls.length).toBeGreaterThan(subjectsBeforeUpdate))
    expect(await screen.findByText('Isolation subject renamed')).toBeInTheDocument()
    expect(tasksSpy.mock.calls.length).toBe(tasksBefore)
    expect(uiSpy.mock.calls.length).toBe(uiBefore)

    const subjectsBeforeDelete = subjectsSpy.mock.calls.length
    await deleteSubject(created.id, { expectedGeneration: 1 })
    await waitFor(() => expect(subjectsSpy.mock.calls.length).toBeGreaterThan(subjectsBeforeDelete))
    await waitFor(() => expect(screen.queryByText('Isolation subject renamed')).not.toBeInTheDocument())
    expect(tasksSpy.mock.calls.length).toBe(tasksBefore)
    expect(uiSpy.mock.calls.length).toBe(uiBefore)
  })

  it('refreshes joined labels on rename without writing linked entity tables', async () => {
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-join',
      name: 'Old name',
      color: '#2563eb',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })
    await createTask({
      title: 'Join task',
      subjectId: 'subject-join',
      dueDate: '',
      priority: 'normal',
      minutes: 20,
    }, { expectedGeneration: 1 })
    await createNote({
      title: 'Join note',
      body: 'body',
      subjectId: 'subject-join',
      tags: [],
    }, { expectedGeneration: 1 })
    const upcomingStart = new Date(Date.now() + 2 * 60 * 60_000).toISOString()
    const upcomingEnd = new Date(Date.now() + 3 * 60 * 60_000).toISOString()
    await createCalendarEvent({
      title: 'Join event',
      subjectId: 'subject-join',
      startAt: upcomingStart,
      endAt: upcomingEnd,
      location: '',
    }, { expectedGeneration: 1 })
    await createStudySession({
      subjectId: 'subject-join',
      startedAt: '2026-07-02T09:00:00.000Z',
      endedAt: '2026-07-02T09:30:00.000Z',
      minutes: 30,
      note: 'Join session',
    }, { expectedGeneration: 1 })

    const subjectsSpy = vi.spyOn(subjectRead, 'listSubjects')
    const tasksSpy = vi.spyOn(taskRead, 'listTasks')
    const notesSpy = vi.spyOn(noteRead, 'listNotes')
    const eventsSpy = vi.spyOn(calendarEventRead, 'listCalendarEvents')
    const sessionsSpy = vi.spyOn(studySessionRead, 'listStudySessions')
    const tasksUpdateSpy = vi.spyOn(studyDb.tasks, 'update')
    const notesUpdateSpy = vi.spyOn(studyDb.notes, 'update')
    const eventsUpdateSpy = vi.spyOn(studyDb.events, 'update')
    const sessionsUpdateSpy = vi.spyOn(studyDb.studySessions, 'update')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(subjectsSpy).toHaveBeenCalled())

    const subjectsBefore = subjectsSpy.mock.calls.length
    const tasksBefore = tasksSpy.mock.calls.length
    const notesBefore = notesSpy.mock.calls.length
    const eventsBefore = eventsSpy.mock.calls.length
    const sessionsBefore = sessionsSpy.mock.calls.length

    await updateSubject('subject-join', {
      name: 'New name',
      color: '#2563eb',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
    }, { expectedGeneration: 1 })

    await waitFor(() => expect(subjectsSpy.mock.calls.length).toBeGreaterThan(subjectsBefore))
    expect(tasksSpy.mock.calls.length).toBe(tasksBefore)
    expect(notesSpy.mock.calls.length).toBe(notesBefore)
    expect(eventsSpy.mock.calls.length).toBe(eventsBefore)
    expect(sessionsSpy.mock.calls.length).toBe(sessionsBefore)
    expect(tasksUpdateSpy).not.toHaveBeenCalled()
    expect(notesUpdateSpy).not.toHaveBeenCalled()
    expect(eventsUpdateSpy).not.toHaveBeenCalled()
    expect(sessionsUpdateSpy).not.toHaveBeenCalled()

    expect((await screen.findAllByText('Join task')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('New name').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Join event').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Notes' }))
    const noteCard = (await screen.findByText('Join note')).closest('.detail-card') as HTMLElement
    expect(within(noteCard).getByText('New name')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Calendar' }))
    expect(await screen.findByText('Join event')).toBeInTheDocument()
    expect(screen.getAllByText('New name').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Progress' }))
    expect(await screen.findByText('New name')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    await user.type(screen.getByPlaceholderText('Search'), 'Join')
    expect((await screen.findAllByText('Join task')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/New name/).length).toBeGreaterThan(0)

    expect((await studyDb.tasks.toArray())[0]?.subjectId).toBe('subject-join')
    expect((await studyDb.notes.toArray())[0]?.subjectId).toBe('subject-join')
  })

  it('blocks linked Subject deletion without cascading linked records', async () => {
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-linked',
      name: 'Protected',
      color: '#b45309',
      targetHours: 4,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })
    await createNote({
      title: 'Keep me',
      body: 'body',
      subjectId: 'subject-linked',
      tags: [],
    }, { expectedGeneration: 1 })

    const subjectsSpy = vi.spyOn(subjectRead, 'listSubjects')
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Subjects' }))
    await waitFor(() => expect(subjectsSpy).toHaveBeenCalled())
    const subjectsBefore = subjectsSpy.mock.calls.length

    await user.click(screen.getByLabelText('Delete Protected'))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Cannot delete Protected/)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(subjectsSpy.mock.calls.length).toBe(subjectsBefore)
    expect(await studyDb.subjects.get('subject-linked')).toBeDefined()
    expect(await studyDb.notes.where('subjectId').equals('subject-linked').count()).toBe(1)
  })

  it('removes unlinked Subjects from editor options after delete', async () => {
    const user = userEvent.setup()
    const created = await createSubject({
      name: 'Removable',
      color: '#2563eb',
      targetHours: 1,
      progress: 0,
      progressMode: 'manual',
    }, { expectedGeneration: 1 })

    const subjectsSpy = vi.spyOn(subjectRead, 'listSubjects')
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    await user.click(screen.getByRole('button', { name: 'New task' }))
    expect(await screen.findByLabelText('Subject')).toContainHTML(created.id)

    const subjectsBefore = subjectsSpy.mock.calls.length
    await deleteSubject(created.id, { expectedGeneration: 1 })
    await waitFor(() => expect(subjectsSpy.mock.calls.length).toBeGreaterThan(subjectsBefore))
    await waitFor(() => {
      expect(screen.getByLabelText('Subject')).not.toContainHTML(created.id)
    })
  })

  it('does not rerun Subjects for Task, Note, Event, Session, Goal, or UI-settings writes', async () => {
    const user = userEvent.setup()
    const subjectsSpy = vi.spyOn(subjectRead, 'listSubjects')
    const tasksSpy = vi.spyOn(taskRead, 'listTasks')
    const notesSpy = vi.spyOn(noteRead, 'listNotes')
    const eventsSpy = vi.spyOn(calendarEventRead, 'listCalendarEvents')
    const sessionsSpy = vi.spyOn(studySessionRead, 'listStudySessions')
    const goalsSpy = vi.spyOn(goalRead, 'listGoals')
    const uiSpy = vi.spyOn(uiSettingsRead, 'getUiSettings')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(subjectsSpy).toHaveBeenCalled())
    const subjectsBaseline = subjectsSpy.mock.calls.length

    await createTask({
      title: 'Unrelated task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      minutes: 20,
    }, { expectedGeneration: 1 })
    await waitFor(() => expect(tasksSpy.mock.calls.length).toBeGreaterThan(0))
    expect(subjectsSpy.mock.calls.length).toBe(subjectsBaseline)

    await createNote({
      title: 'Unrelated note',
      body: 'body',
      subjectId: '',
      tags: [],
    }, { expectedGeneration: 1 })
    await waitFor(() => expect(notesSpy.mock.calls.length).toBeGreaterThan(0))
    expect(subjectsSpy.mock.calls.length).toBe(subjectsBaseline)

    await createCalendarEvent({
      title: 'Unrelated event',
      subjectId: '',
      startAt: '2026-07-10T10:00:00.000Z',
      endAt: '2026-07-10T11:00:00.000Z',
      location: '',
    }, { expectedGeneration: 1 })
    await waitFor(() => expect(eventsSpy.mock.calls.length).toBeGreaterThan(0))
    expect(subjectsSpy.mock.calls.length).toBe(subjectsBaseline)

    await createStudySession({
      subjectId: '',
      startedAt: '2026-07-02T09:00:00.000Z',
      endedAt: '2026-07-02T09:30:00.000Z',
      minutes: 30,
      note: '',
    }, { expectedGeneration: 1 })
    await waitFor(() => expect(sessionsSpy.mock.calls.length).toBeGreaterThan(0))
    expect(subjectsSpy.mock.calls.length).toBe(subjectsBaseline)

    await user.click(screen.getByRole('button', { name: 'Goals' }))
    await screen.findByRole('heading', { name: 'Goals' })
    await waitFor(() => expect(goalsSpy).toHaveBeenCalled())
    const goalsBefore = goalsSpy.mock.calls.length
    const subjectsBeforeGoal = subjectsSpy.mock.calls.length
    await createGoal({
      title: 'Manual goal only',
      target: 30,
      progress: 0,
      period: 'weekly',
      metric: 'manual',
    }, { expectedGeneration: 1 })
    await waitFor(() => expect(goalsSpy.mock.calls.length).toBeGreaterThan(goalsBefore))
    expect(subjectsSpy.mock.calls.length).toBe(subjectsBeforeGoal)

    await user.click(screen.getByRole('button', { name: 'Home' }))
    const uiBefore = uiSpy.mock.calls.length
    const subjectsBeforeUi = subjectsSpy.mock.calls.length
    fireEvent.change(screen.getByLabelText('Quick notes'), { target: { value: 'settings only' } })
    await waitFor(() => expect(uiSpy.mock.calls.length).toBeGreaterThan(uiBefore))
    expect(subjectsSpy.mock.calls.length).toBe(subjectsBeforeUi)
  })

  it('does not rerun Subjects for focus start, pause, resume, or finalize and resolves names from the map', async () => {
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-focus',
      name: 'Focus Chemistry',
      color: '#2563eb',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    const subjectsSpy = vi.spyOn(subjectRead, 'listSubjects')
    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(subjectsSpy).toHaveBeenCalled())
    const subjectsBefore = subjectsSpy.mock.calls.length

    await user.selectOptions(await screen.findByLabelText('Focus subject'), 'subject-focus')
    await user.click(await waitForFocusStartEnabled())
    await waitFor(async () => {
      expect(await getActiveFocusSession()).toMatchObject({ subjectId: 'subject-focus', status: 'running' })
    })
    expect(subjectsSpy.mock.calls.length).toBe(subjectsBefore)
    expect(screen.getByLabelText('Focus subject')).toHaveDisplayValue('Focus Chemistry')

    const active = await getActiveFocusSession()
    expect(active).not.toBeNull()
    await pauseActiveFocusSession(active!.id, new Date().toISOString(), { expectedGeneration: 1 })
    await waitFor(async () => {
      expect((await getActiveFocusSession())?.status).toBe('paused')
    })
    expect(subjectsSpy.mock.calls.length).toBe(subjectsBefore)

    const paused = await getActiveFocusSession()
    await resumeActiveFocusSession(paused!.id, Date.now(), { expectedGeneration: 1 })
    await waitFor(async () => {
      expect((await getActiveFocusSession())?.status).toBe('running')
    })
    expect(subjectsSpy.mock.calls.length).toBe(subjectsBefore)

    await updateSubject('subject-focus', {
      name: 'Renamed Focus',
      color: '#2563eb',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
    }, { expectedGeneration: 1 })
    await waitFor(() => expect(subjectsSpy.mock.calls.length).toBeGreaterThan(subjectsBefore))
    const afterRename = subjectsSpy.mock.calls.length
    expect(await screen.findByLabelText('Focus subject')).toHaveDisplayValue('Renamed Focus')

    const running = await getActiveFocusSession()
    await finalizeActiveFocusSession(running!.id, {
      subjectId: running!.subjectId,
      startedAt: running!.startedAt,
      endedAt: new Date().toISOString(),
      minutes: 5,
      note: 'Focus session',
    }, { expectedGeneration: 1 })
    await waitFor(async () => {
      expect(await getActiveFocusSession()).toBeNull()
    })
    expect(subjectsSpy.mock.calls.length).toBe(afterRename)
  })

  it('preserves Unknown subject and General focus display fallbacks without Subjects reruns', async () => {
    await studyDb.settings.put({
      key: ACTIVE_FOCUS_SESSION_KEY,
      value: makeDurableFocusSession({
        id: 'focus-unknown',
        subjectId: 'missing-subject',
        startedAt: new Date(Date.now() - ACTIVE_FOCUS_SESSION_STALE_AFTER_MS - 60_000).toISOString(),
        plannedMinutes: 0,
        status: 'running',
        pausedAt: null,
        accumulatedPausedMs: 0,
      }),
    })

    const subjectsSpy = vi.spyOn(subjectRead, 'listSubjects')
    const { unmount } = render(<App />)
    expect(await screen.findByText(/It was running for Unknown subject/)).toBeInTheDocument()
    await waitFor(() => expect(subjectsSpy).toHaveBeenCalled())
    expect(subjectsSpy.mock.calls.length).toBeGreaterThan(0)
    unmount()

    await resetAppTestEnvironment()
    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-general',
      subjectId: '',
      startedAt: new Date(Date.now() - ACTIVE_FOCUS_SESSION_STALE_AFTER_MS - 60_000).toISOString(),
      plannedMinutes: 0,
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: 0,
    }), { expectedGeneration: 1 })

    const subjectsSpy2 = vi.spyOn(subjectRead, 'listSubjects')
    render(<App />)
    expect(await screen.findByText(/It was running for General/)).toBeInTheDocument()
    await waitFor(() => expect(subjectsSpy2).toHaveBeenCalled())
    const before = subjectsSpy2.mock.calls.length
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40))
    })
    expect(subjectsSpy2.mock.calls.length).toBe(before)
  })

  it('refreshes Subjects after import without reload and rejects orphan subject refs', async () => {
    await studyDb.subjects.add({
      id: 'subject-before',
      name: 'Before import',
      color: '#2563eb',
      targetHours: 1,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    const subjectsSpy = vi.spyOn(subjectRead, 'listSubjects')
    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    expect(screen.getAllByText('Before import').length).toBeGreaterThan(0)
    await waitFor(() => expect(subjectsSpy).toHaveBeenCalled())
    const subjectsBefore = subjectsSpy.mock.calls.length

    await expect(
      importStudyData(
        makeEmptyExport({
          version: 3,
          tasks: [
            {
              id: 'task-orphan',
              title: 'Orphan',
              subjectId: 'missing-subject',
              dueDate: '',
              priority: 'normal',
              status: 'open',
              minutes: 20,
              createdAt: '2026-07-01T00:00:00.000Z',
              updatedAt: '2026-07-01T00:00:00.000Z',
            },
          ],
          subjects: [],
        }),
      ),
    ).rejects.toThrow('Import file is not a Study Dashboard export.')
    expect(await studyDb.subjects.get('subject-before')).toBeDefined()
    expect(subjectsSpy.mock.calls.length).toBe(subjectsBefore)

    await importStudyData(
      makeEmptyExport({
        version: 3,
        subjects: [
          {
            id: 'subject-imported',
            name: 'Imported subject',
            color: '#0f766e',
            targetHours: 2,
            progress: 5,
            progressMode: 'manual',
            createdAt: '2026-07-02T00:00:00.000Z',
            updatedAt: '2026-07-02T00:00:00.000Z',
          },
        ],
        settings: [{ key: 'legacy-localstorage-migrated-v1', value: true }],
      }),
    )

    await waitFor(() => expect(subjectsSpy.mock.calls.length).toBeGreaterThan(subjectsBefore))
    await waitFor(async () => {
      expect(await studyDb.subjects.count()).toBe(1)
      expect((await studyDb.subjects.toArray())[0]?.name).toBe('Imported subject')
    })
    await waitFor(() => {
      expect(screen.getAllByText('Imported subject').length).toBeGreaterThan(0)
    })
    await waitFor(() => expect(screen.queryByText('Before import')).not.toBeInTheDocument())
  })

  it('refreshes Subjects after clear-all without reload', async () => {
    await studyDb.subjects.add({
      id: 'subject-clear',
      name: 'Clear subject',
      color: '#2563eb',
      targetHours: 1,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    const subjectsSpy = vi.spyOn(subjectRead, 'listSubjects')
    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    expect(screen.getAllByText('Clear subject').length).toBeGreaterThan(0)
    await waitFor(() => expect(subjectsSpy).toHaveBeenCalled())
    const subjectsBefore = subjectsSpy.mock.calls.length

    await clearAllStudyData()

    await waitFor(() => expect(subjectsSpy.mock.calls.length).toBeGreaterThan(subjectsBefore))
    await waitFor(() => expect(screen.queryByText('Clear subject')).not.toBeInTheDocument())
    expect(await studyDb.subjects.count()).toBe(0)
  })

  it('waits for Subjects before first paint so seeded options do not flash empty', async () => {
    await studyDb.subjects.add({
      id: 'subject-seed',
      name: 'Seeded subject',
      color: '#2563eb',
      targetHours: 1,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    let release!: (value: Awaited<ReturnType<typeof subjectRead.listSubjects>>) => void
    const gate = new Promise<Awaited<ReturnType<typeof subjectRead.listSubjects>>>((resolve) => {
      release = resolve
    })
    const original = subjectRead.listSubjects
    vi.spyOn(subjectRead, 'listSubjects').mockImplementation(() => gate)

    render(<App />)
    expect(screen.queryByRole('heading', { name: /Good (morning|afternoon|evening)/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Loading your study space/i)).toBeInTheDocument()

    await act(async () => {
      release(await original())
    })

    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Focus subject')).toContainHTML('subject-seed')
    expect(screen.getAllByText('Seeded subject').length).toBeGreaterThan(0)
  })

  it('keeps full getStudyData / export snapshots including Subjects in createdAt order', async () => {
    await studyDb.subjects.bulkPut([
      {
        id: 'subject-later',
        name: 'Later',
        color: '#0f766e',
        targetHours: 1,
        progress: 0,
        progressMode: 'manual',
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T00:00:00.000Z',
      },
      {
        id: 'subject-earlier',
        name: 'Earlier',
        color: '#2563eb',
        targetHours: 1,
        progress: 0,
        progressMode: 'manual',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
    ])

    const full = await getStudyData()
    const exported = await exportStudyData()
    expect(full.subjects.map((subject) => subject.id)).toEqual(['subject-earlier', 'subject-later'])
    expect(exported.subjects).toEqual(full.subjects)
    expect(exported.version).toBe(4)
  })

  it('Goals remain independent of Subject rows', async () => {
    const user = userEvent.setup()
    const subjectsSpy = vi.spyOn(subjectRead, 'listSubjects')
    const goalsSpy = vi.spyOn(goalRead, 'listGoals')

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await screen.findByRole('heading', { name: 'Goals' })
    await waitFor(() => expect(goalsSpy).toHaveBeenCalled())
    await waitFor(() => expect(subjectsSpy).toHaveBeenCalled())
    const subjectsBefore = subjectsSpy.mock.calls.length
    const goalsBefore = goalsSpy.mock.calls.length

    await createGoal({
      title: 'Independent goal',
      target: 10,
      progress: 0,
      period: 'weekly',
      metric: 'manual',
    }, { expectedGeneration: 1 })
    await waitFor(() => expect(goalsSpy.mock.calls.length).toBeGreaterThan(goalsBefore))
    expect(subjectsSpy.mock.calls.length).toBe(subjectsBefore)
    expect(await screen.findByText('Independent goal')).toBeInTheDocument()

    await createSubject({
      name: 'Does not affect goals',
      color: '#2563eb',
      targetHours: 1,
      progress: 0,
      progressMode: 'manual',
    }, { expectedGeneration: 1 })
    await waitFor(() => expect(subjectsSpy.mock.calls.length).toBeGreaterThan(subjectsBefore))
    expect(screen.getByText('Independent goal')).toBeInTheDocument()
  })
})
