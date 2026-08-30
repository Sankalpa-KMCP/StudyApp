import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as subjectRead from './db/subjectRead'
import * as goalRead from './db/goalRead'
import { createGoal } from './db/goalService'
import { createNote } from './db/notesService'
import * as noteRead from './db/noteRead'
import { createStudySession } from './db/studySessionService'
import { createTask } from './db/taskService'
import * as taskRead from './db/taskRead'
import { exportStudyData, getStudyData, studyDb } from './db/studyDb'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'

async function openGoalsWorkspace(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Goals' }))
  await screen.findByRole('heading', { name: 'Goals' })
  await waitFor(() => expect(goalRead.listGoals).toHaveBeenCalled())
}

describe('App goals live query isolation', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('refreshes Goals without rerunning the Subjects query for a non-qualifying Goal write', async () => {
    const user = userEvent.setup()
    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const goalsSpy = vi.spyOn(goalRead, 'listGoals')

    await openGoalsWorkspace(user)
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const goalsBefore = goalsSpy.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Manual isolation goal')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Manual isolation goal')).toBeInTheDocument()

    await waitFor(() => expect(goalsSpy.mock.calls.length).toBeGreaterThan(goalsBefore))
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
  })

  it('refreshes Goals without rerunning Subjects when a qualifying daily study-time Goal updates settings', async () => {
    const user = userEvent.setup()
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 100 })
    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const goalsSpy = vi.spyOn(goalRead, 'listGoals')

    await openGoalsWorkspace(user)
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const goalsBefore = goalsSpy.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Daily study sync')
    await user.selectOptions(screen.getByLabelText('Metric'), 'study_time')
    await user.selectOptions(screen.getByLabelText('Period'), 'daily')
    await user.clear(screen.getByLabelText(/Target \(minutes\)/))
    await user.type(screen.getByLabelText(/Target \(minutes\)/), '75')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Daily study sync')).toBeInTheDocument()
    await waitFor(async () => {
      expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(75)
    })

    await waitFor(() => expect(goalsSpy.mock.calls.length).toBeGreaterThan(goalsBefore))
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
  })

  it('does not rerun the Goals query for unrelated task or note writes', async () => {
    const user = userEvent.setup()
    await createGoal({
      title: 'Existing goal',
      target: 30,
      progress: 0,
      period: 'daily',
      metric: 'manual',
    })
    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const goalsSpy = vi.spyOn(goalRead, 'listGoals')
    const tasksSpy = vi.spyOn(taskRead, 'listTasks')
    const notesSpy = vi.spyOn(noteRead, 'listNotes')

    await openGoalsWorkspace(user)
    expect(await screen.findByText('Existing goal')).toBeInTheDocument()
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(tasksSpy).toHaveBeenCalled())
    await waitFor(() => expect(notesSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const goalsBefore = goalsSpy.mock.calls.length
    const tasksBefore = tasksSpy.mock.calls.length
    const notesBefore = notesSpy.mock.calls.length

    await createTask({
      title: 'Unrelated task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      minutes: 25,
    })
    await waitFor(() => expect(tasksSpy.mock.calls.length).toBeGreaterThan(tasksBefore))
    expect(goalsSpy.mock.calls.length).toBe(goalsBefore)
    expect(shellSpy.mock.calls.length).toBe(shellBefore)

    await createNote({
      title: 'Unrelated note',
      body: 'body',
      subjectId: '',
      tags: [],
    })

    await waitFor(() => expect(notesSpy.mock.calls.length).toBeGreaterThan(notesBefore))
    expect(goalsSpy.mock.calls.length).toBe(goalsBefore)
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
  })

  it('updates Goal progress from App studySessions without rereading Goal rows', async () => {
    const user = userEvent.setup()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))

    await createGoal({
      title: 'Study time goal',
      target: 60,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
    })

    const goalsSpy = vi.spyOn(goalRead, 'listGoals')
    await openGoalsWorkspace(user)
    expect(await screen.findByText('Study time goal')).toBeInTheDocument()
    expect(screen.getByText('0/60 minutes')).toBeInTheDocument()
    const goalsBefore = goalsSpy.mock.calls.length

    await createStudySession({
      subjectId: '',
      startedAt: new Date(2026, 6, 13, 10, 0).toISOString(),
      endedAt: new Date(2026, 6, 13, 10, 30).toISOString(),
      minutes: 30,
      note: '',
    })

    await waitFor(() => expect(screen.getByText('30/60 minutes')).toBeInTheDocument())
    expect(goalsSpy.mock.calls.length).toBe(goalsBefore)

    vi.useRealTimers()
  })

  it('refreshes Goals after Dexie Goal-table replacement without a page reload', async () => {
    const user = userEvent.setup()
    await createGoal({
      title: 'Imported-bound goal',
      target: 40,
      progress: 5,
      period: 'weekly',
      metric: 'manual',
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    expect(await screen.findByText('Imported-bound goal')).toBeInTheDocument()

    const snapshot = await exportStudyData()
    expect(snapshot.goals.map((goal) => goal.title)).toContain('Imported-bound goal')

    await studyDb.goals.clear()
    await waitFor(() => expect(screen.getByText('No goals yet')).toBeInTheDocument())

    await studyDb.goals.bulkPut(snapshot.goals)
    expect(await screen.findByText('Imported-bound goal')).toBeInTheDocument()
  })

  it('keeps full getStudyData / export snapshots including Goals', async () => {
    await createGoal({
      title: 'Export goal',
      target: 50,
      progress: 0,
      period: 'daily',
      metric: 'manual',
    })
    const full = await getStudyData()
    const exported = await exportStudyData()
    expect(full.goals).toHaveLength(1)
    expect(full.goals[0]?.title).toBe('Export goal')
    expect(exported.goals).toEqual(full.goals)
    expect(exported.version).toBe(4)
  })
})
