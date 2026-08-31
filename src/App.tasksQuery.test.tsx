import { act, render, screen, waitFor, within } from '@testing-library/react'
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
import {
  createTask,
  deleteTask,
  setTaskStatus,
  updateTask,
} from './db/taskService'
import { saveQuickNotes } from './db/quickNotesService'
import { createStudySession } from './db/studySessionService'
import * as studySessionRead from './db/studySessionRead'
import { exportStudyData, getStudyData, studyDb } from './db/studyDb'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'

describe('App tasks live query isolation', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('reruns Tasks without rerunning the Subjects query for task writes and updates consumers', async () => {
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-tasks',
      name: 'Algebra',
      color: '#2563eb',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const tasksSpy = vi.spyOn(taskRead, 'listTasks')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(tasksSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const tasksBefore = tasksSpy.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Tasks' }))
    await user.click(screen.getByRole('button', { name: 'New task' }))
    await user.type(await screen.findByLabelText('Task title'), 'Isolation task')
    await user.selectOptions(screen.getByLabelText('Subject'), 'subject-tasks')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Isolation task')).toBeInTheDocument()

    await waitFor(() => expect(tasksSpy.mock.calls.length).toBeGreaterThan(tasksBefore))
    expect(shellSpy.mock.calls.length).toBe(shellBefore)

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(screen.getByText('Isolation task')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Progress' }))
    expect(await screen.findByText('Tasks complete')).toBeInTheDocument()
    expect(screen.getByText('0/1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Subjects' }))
    const subjectCard = (await screen.findByText('Algebra')).closest('article') as HTMLElement
    expect(within(subjectCard).getByText(/1 linked records/i)).toBeInTheDocument()
  }, 15_000)

  it('does not rerun Tasks or query Dexie when only taskFilter changes', async () => {
    const user = userEvent.setup()
    await createTask({
      title: 'Open filter task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      minutes: 20,
    }, { expectedGeneration: 1 })
    await createTask({
      title: 'Done filter task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      minutes: 15,
    }, { expectedGeneration: 1 }).then(async (task) => {
      await setTaskStatus(task.id, 'done', { expectedGeneration: 1 })
    })

    const tasksSpy = vi.spyOn(taskRead, 'listTasks')
    const tasksTableSpy = vi.spyOn(studyDb.tasks, 'orderBy')

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    expect(await screen.findByText('Open filter task')).toBeInTheDocument()
    expect(screen.getByText('Done filter task')).toBeInTheDocument()
    await waitFor(() => expect(tasksSpy).toHaveBeenCalled())
    const tasksBefore = tasksSpy.mock.calls.length
    const orderByBefore = tasksTableSpy.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'open' }))
    expect(screen.getByText('Open filter task')).toBeInTheDocument()
    expect(screen.queryByText('Done filter task')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'done' }))
    expect(screen.getByText('Done filter task')).toBeInTheDocument()
    expect(screen.queryByText('Open filter task')).not.toBeInTheDocument()

    expect(tasksSpy.mock.calls.length).toBe(tasksBefore)
    expect(tasksTableSpy.mock.calls.length).toBe(orderByBefore)
  })

  it('does not rerun Tasks for study-session writes', async () => {
    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const tasksSpy = vi.spyOn(taskRead, 'listTasks')
    const sessionsSpy = vi.spyOn(studySessionRead, 'listStudySessions')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(tasksSpy).toHaveBeenCalled())
    await waitFor(() => expect(sessionsSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const tasksBefore = tasksSpy.mock.calls.length
    const sessionsBefore = sessionsSpy.mock.calls.length

    await createStudySession({
      subjectId: '',
      startedAt: '2026-07-02T09:00:00.000Z',
      endedAt: '2026-07-02T09:30:00.000Z',
      minutes: 30,
      note: 'manual',
    }, { expectedGeneration: 1 })

    await waitFor(() => expect(sessionsSpy.mock.calls.length).toBeGreaterThan(sessionsBefore))
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
    expect(tasksSpy.mock.calls.length).toBe(tasksBefore)
  })

  it('does not rerun Tasks for Note writes', async () => {
    const notesSpy = vi.spyOn(noteRead, 'listNotes')
    const tasksSpy = vi.spyOn(taskRead, 'listTasks')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(notesSpy).toHaveBeenCalled())
    await waitFor(() => expect(tasksSpy).toHaveBeenCalled())
    const notesBefore = notesSpy.mock.calls.length
    const tasksBefore = tasksSpy.mock.calls.length

    await createNote({
      title: 'Unrelated note',
      body: 'body',
      subjectId: '',
      tags: [],
    }, { expectedGeneration: 1 })

    await waitFor(() => expect(notesSpy.mock.calls.length).toBeGreaterThan(notesBefore))
    expect(tasksSpy.mock.calls.length).toBe(tasksBefore)
  })

  it('does not rerun Tasks for Calendar event writes', async () => {
    const eventsSpy = vi.spyOn(calendarEventRead, 'listCalendarEvents')
    const tasksSpy = vi.spyOn(taskRead, 'listTasks')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(eventsSpy).toHaveBeenCalled())
    await waitFor(() => expect(tasksSpy).toHaveBeenCalled())
    const eventsBefore = eventsSpy.mock.calls.length
    const tasksBefore = tasksSpy.mock.calls.length

    await createCalendarEvent({
      title: 'Unrelated event',
      subjectId: '',
      startAt: '2026-07-10T10:00:00.000Z',
      endAt: '2026-07-10T11:00:00.000Z',
      location: '',
    }, { expectedGeneration: 1 })

    await waitFor(() => expect(eventsSpy.mock.calls.length).toBeGreaterThan(eventsBefore))
    expect(tasksSpy.mock.calls.length).toBe(tasksBefore)
  })

  it('does not rerun Tasks for a Goal-only write', async () => {
    const user = userEvent.setup()
    const tasksSpy = vi.spyOn(taskRead, 'listTasks')
    const goalsSpy = vi.spyOn(goalRead, 'listGoals')

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await screen.findByRole('heading', { name: 'Goals' })
    await waitFor(() => expect(tasksSpy).toHaveBeenCalled())
    await waitFor(() => expect(goalsSpy).toHaveBeenCalled())
    const tasksBefore = tasksSpy.mock.calls.length
    const goalsBefore = goalsSpy.mock.calls.length

    await createGoal({
      title: 'Manual goal only',
      target: 30,
      progress: 0,
      period: 'weekly',
      metric: 'manual',
    }, { expectedGeneration: 1 })

    await waitFor(() => expect(goalsSpy.mock.calls.length).toBeGreaterThan(goalsBefore))
    expect(tasksSpy.mock.calls.length).toBe(tasksBefore)
  })

  it('does not rerun Tasks for Quick Notes settings writes', async () => {
    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const tasksSpy = vi.spyOn(taskRead, 'listTasks')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(tasksSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const tasksBefore = tasksSpy.mock.calls.length

    await saveQuickNotes('Quick line one', { expectedGeneration: 1 })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40))
    })
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
    expect(tasksSpy.mock.calls.length).toBe(tasksBefore)
  })

  it('refreshes Tasks after Dexie clear and restore without a page reload', async () => {
    const user = userEvent.setup()
    const created = await createTask({
      title: 'Restore me',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      minutes: 25,
    }, { expectedGeneration: 1 })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    expect(await screen.findByText('Restore me')).toBeInTheDocument()

    const snapshot = await exportStudyData()
    expect(snapshot.tasks.map((task) => task.title)).toContain('Restore me')

    await studyDb.tasks.clear()
    await waitFor(() => expect(screen.getByText('No tasks yet')).toBeInTheDocument())

    await studyDb.tasks.bulkPut(snapshot.tasks)
    expect(await screen.findByText('Restore me')).toBeInTheDocument()
    expect(created.id).toBe(snapshot.tasks[0]?.id)
  })

  it('keeps full getStudyData / export snapshots including Tasks', async () => {
    await createTask({
      title: 'Export task',
      subjectId: '',
      dueDate: '2026-07-20',
      priority: 'high',
      minutes: 40,
    }, { expectedGeneration: 1 })
    const full = await getStudyData()
    const exported = await exportStudyData()
    expect(full.tasks).toHaveLength(1)
    expect(full.tasks[0]?.title).toBe('Export task')
    expect(exported.tasks).toEqual(full.tasks)
    expect(exported.version).toBe(4)
  })

  it('updates Tasks after toggle, edit, and delete without shell Tasks reads', async () => {
    const created = await createTask({
      title: 'Mutate me',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      minutes: 20,
    }, { expectedGeneration: 1 })

    const user = userEvent.setup()
    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const tasksSpy = vi.spyOn(taskRead, 'listTasks')

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    expect(await screen.findByText('Mutate me')).toBeInTheDocument()

    const shellBefore = shellSpy.mock.calls.length
    const tasksBefore = tasksSpy.mock.calls.length
    await setTaskStatus(created.id, 'done', { expectedGeneration: 1 })

    await waitFor(() => expect(tasksSpy.mock.calls.length).toBeGreaterThan(tasksBefore))
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
    await waitFor(() => expect(screen.getByText('Mutate me').closest('.list-row')).toHaveClass('is-done'))

    await updateTask(created.id, {
      title: 'Mutate me updated',
      subjectId: '',
      dueDate: '',
      priority: 'high',
      minutes: 25,
    }, { expectedGeneration: 1 })
    expect(await screen.findByText('Mutate me updated')).toBeInTheDocument()

    await deleteTask(created.id, { expectedGeneration: 1 })
    await waitFor(() => expect(screen.queryByText('Mutate me updated')).not.toBeInTheDocument())
  })

  it('introduces no Task query invalidation from wall-clock progression alone', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0, 0, 0))

    await createTask({
      title: 'Clock-stable task',
      subjectId: '',
      dueDate: '2026-07-10',
      priority: 'normal',
      minutes: 20,
    }, { expectedGeneration: 1 })

    const tasksSpy = vi.spyOn(taskRead, 'listTasks')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(tasksSpy).toHaveBeenCalled())
    const tasksBefore = tasksSpy.mock.calls.length
    const taskCountBefore = await studyDb.tasks.count()

    await act(async () => {
      vi.setSystemTime(new Date(2026, 6, 14, 9, 0, 0, 0))
    })

    expect(tasksSpy.mock.calls.length).toBe(tasksBefore)
    expect(await studyDb.tasks.count()).toBe(taskCountBefore)
    vi.useRealTimers()
  })
})
