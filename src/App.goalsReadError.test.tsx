import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { LIVE_READ_ERROR_MESSAGE } from './components/AppLiveReadFallback'
import { GOALS_LIVE_READ_ERROR_MESSAGE } from './views/GoalsView'
import * as goalRead from './db/goalRead'
import * as goalService from './db/goalService'
import * as subjectRead from './db/subjectRead'
import * as noteRead from './db/noteRead'
import * as taskRead from './db/taskRead'
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

async function openGoals(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Goals' }))
  await screen.findByRole('heading', { name: 'Goals' })
}

describe('Goals live-read recovery', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('shows a local Goals alert and Retry when listGoals rejects initially', async () => {
    silenceBoundaryConsole()
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-shell',
      name: 'Shell subject',
      color: '#2563eb',
      targetHours: 2,
      progress: 10,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })
    vi.spyOn(goalRead, 'listGoals').mockRejectedValue(new Error('goals boom'))

    render(<App />)
    await openGoals(user)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(GOALS_LIVE_READ_ERROR_MESSAGE)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
    expect(screen.queryByText(LIVE_READ_ERROR_MESSAGE)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(window.location.pathname).toBe(pathForView('Goals'))
    expect(within(screen.getByRole('banner')).getByText('Goals')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Subjects' }))
    expect(await screen.findByText('Shell subject')).toBeInTheDocument()
    expect(screen.queryByText(LIVE_READ_ERROR_MESSAGE)).not.toBeInTheDocument()
    expect(screen.queryByText(GOALS_LIVE_READ_ERROR_MESSAGE)).not.toBeInTheDocument()
  })

  it('retries through Goals loading and restores goals without remounting App readers', async () => {
    silenceBoundaryConsole()
    const user = userEvent.setup()
    await studyDb.goals.add({
      id: 'goal-recover',
      title: 'Recovered goal',
      target: 40,
      progress: 5,
      period: 'weekly',
      metric: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    let release!: (value: Awaited<ReturnType<typeof goalRead.listGoals>>) => void
    const gate = new Promise<Awaited<ReturnType<typeof goalRead.listGoals>>>((resolve) => {
      release = resolve
    })
    let shouldFail = true
    const goalsSpy = vi.spyOn(goalRead, 'listGoals').mockImplementation(async () => {
      if (shouldFail) throw new Error('goals unavailable')
      return gate
    })
    const subjectsSpy = vi.spyOn(subjectRead, 'listSubjects')
    const notesSpy = vi.spyOn(noteRead, 'listNotes')
    const tasksSpy = vi.spyOn(taskRead, 'listTasks')

    render(<App />)
    await waitFor(() => expect(subjectsSpy).toHaveBeenCalled())
    await openGoals(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(GOALS_LIVE_READ_ERROR_MESSAGE)
    const goalsBeforeRetry = goalsSpy.mock.calls.length
    const subjectsBeforeRetry = subjectsSpy.mock.calls.length
    const notesBeforeRetry = notesSpy.mock.calls.length
    const tasksBeforeRetry = tasksSpy.mock.calls.length

    shouldFail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Loading goals...')).toBeInTheDocument()
    expect(screen.getByText('Loading goals...')).toHaveAttribute('aria-live', 'polite')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(LIVE_READ_ERROR_MESSAGE)).not.toBeInTheDocument()

    release(await studyDb.goals.orderBy('createdAt').toArray())

    expect(await screen.findByText('Recovered goal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New goal' })).toBeInTheDocument()
    expect(goalsSpy.mock.calls.length).toBeGreaterThan(goalsBeforeRetry)
    expect(subjectsSpy.mock.calls.length).toBe(subjectsBeforeRetry)
    expect(notesSpy.mock.calls.length).toBe(notesBeforeRetry)
    expect(tasksSpy.mock.calls.length).toBe(tasksBeforeRetry)
    expect(await studyDb.goals.get('goal-recover')).toMatchObject({ title: 'Recovered goal' })
  })

  it('returns to the same local error state when Goals Retry still fails', async () => {
    silenceBoundaryConsole()
    const user = userEvent.setup()
    const goalsSpy = vi.spyOn(goalRead, 'listGoals').mockRejectedValue(new Error('goals unavailable'))

    render(<App />)
    await openGoals(user)
    expect(await screen.findByRole('alert')).toHaveTextContent(GOALS_LIVE_READ_ERROR_MESSAGE)
    const callsBeforeRetry = goalsSpy.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(GOALS_LIVE_READ_ERROR_MESSAGE)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
    expect(goalsSpy.mock.calls.length).toBeGreaterThan(callsBeforeRetry)
    expect(screen.queryByText(LIVE_READ_ERROR_MESSAGE)).not.toBeInTheDocument()
  })

  it('does not leak duplicate Goals subscriptions across a successful Retry', async () => {
    silenceBoundaryConsole()
    const user = userEvent.setup()
    let shouldFail = true
    const goalsSpy = vi.spyOn(goalRead, 'listGoals').mockImplementation(async () => {
      if (shouldFail) throw new Error('goals unavailable')
      return studyDb.goals.orderBy('createdAt').toArray()
    })

    render(<App />)
    await openGoals(user)
    await screen.findByRole('alert')
    shouldFail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('No goals yet')

    const callsAfterRecovery = goalsSpy.mock.calls.length
    await studyDb.goals.add({
      id: 'goal-after-retry',
      title: 'After retry goal',
      target: 20,
      progress: 0,
      period: 'daily',
      metric: 'manual',
      createdAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
    })

    await waitFor(() => expect(screen.getByText('After retry goal')).toBeInTheDocument())
    await waitFor(() => expect(goalsSpy.mock.calls.length).toBeGreaterThan(callsAfterRecovery))
    expect(goalsSpy.mock.calls.length - callsAfterRecovery).toBeLessThanOrEqual(2)
  })

  it('preserves IndexedDB goals, subjects, and focus across Goals failure and Retry', async () => {
    silenceBoundaryConsole()
    const user = userEvent.setup()
    await studyDb.goals.add({
      id: 'goal-keep',
      title: 'Keep me',
      target: 30,
      progress: 0,
      period: 'daily',
      metric: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })
    await studyDb.subjects.add({
      id: 'subject-keep',
      name: 'Keep subject',
      color: '#2563eb',
      targetHours: 1,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })
    const session = makeDurableFocusSession({
      id: 'focus-survive-goals-read',
      subjectId: '',
      plannedMinutes: 25,
      status: 'running',
    })
    expect(await createActiveFocusSession(session, { expectedGeneration: 1 })).toMatchObject({ ok: true })

    let shouldFail = true
    vi.spyOn(goalRead, 'listGoals').mockImplementation(async () => {
      if (shouldFail) throw new Error('goals unavailable')
      return studyDb.goals.orderBy('createdAt').toArray()
    })

    render(<App />)
    await openGoals(user)
    expect(await screen.findByRole('alert')).toHaveTextContent(GOALS_LIVE_READ_ERROR_MESSAGE)
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-survive-goals-read', status: 'running' })
    expect((await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY))?.value).toMatchObject({
      id: 'focus-survive-goals-read',
    })

    shouldFail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Keep me')).toBeInTheDocument()
    expect(await studyDb.goals.get('goal-keep')).toMatchObject({ title: 'Keep me' })
    expect(await studyDb.subjects.get('subject-keep')).toMatchObject({ name: 'Keep subject' })
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-survive-goals-read', status: 'running' })

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('keeps Goal mutation failures on MutationNotice instead of the read fallback', async () => {
    const user = userEvent.setup()
    vi.spyOn(goalService, 'createGoal').mockRejectedValue(new Error('write boom'))

    render(<App />)
    await openGoals(user)
    expect(await screen.findByText('No goals yet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Mutation fail goal')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Goal could not be saved. Your details are still in the form.',
    )
    expect(screen.queryByText(GOALS_LIVE_READ_ERROR_MESSAGE)).not.toBeInTheDocument()
    expect(screen.queryByText(LIVE_READ_ERROR_MESSAGE)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Goal title')).toHaveValue('Mutation fail goal')
  })

  it('treats an empty successful Goals result as loaded empty state', async () => {
    const user = userEvent.setup()
    vi.spyOn(goalRead, 'listGoals').mockResolvedValue([])

    render(<App />)
    await openGoals(user)

    expect(await screen.findByText('No goals yet')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Loading goals...')).not.toBeInTheDocument()
  })
})
