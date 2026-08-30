import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as subjectRead from './db/subjectRead'
import * as calendarEventRead from './db/calendarEventRead'
import { createCalendarEvent } from './db/calendarEventService'
import * as goalRead from './db/goalRead'
import { createGoal, deleteGoal, updateGoal } from './db/goalService'
import { createNote } from './db/notesService'
import * as noteRead from './db/noteRead'
import * as taskRead from './db/taskRead'
import { createTask } from './db/taskService'
import * as studySessionRead from './db/studySessionRead'
import { createStudySession } from './db/studySessionService'
import { createSubject } from './db/subjectService'
import * as uiSettingsRead from './db/uiSettingsRead'
import {
  ACTIVE_FOCUS_SESSION_KEY,
  createActiveFocusSession,
  getActiveFocusSession,
} from './db/activeFocusSession'
import { exportStudyData, getStudyData, clearAllStudyData, importStudyData, studyDb } from './db/studyDb'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'
import { makeDurableFocusSession, waitForFocusStartEnabled } from './test/focusTestHelpers'
import { makeEmptyExport } from './test/backupTestHelpers'

describe('App UI settings live query isolation', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('reruns UI settings without rerunning Subjects for Quick Notes saves and refreshes Home', async () => {
    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const uiSpy = vi.spyOn(uiSettingsRead, 'getUiSettings')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(uiSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const uiBefore = uiSpy.mock.calls.length

    const textarea = screen.getByLabelText('Quick notes')
    fireEvent.change(textarea, { target: { value: 'Live quick note' } })
    await waitFor(async () => {
      expect((await studyDb.settings.get('quickNotes'))?.value).toEqual(['Live quick note'])
    })
    await waitFor(() => expect(screen.getByText('Saved locally')).toBeInTheDocument())

    await waitFor(() => expect(uiSpy.mock.calls.length).toBeGreaterThan(uiBefore))
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
    await waitFor(() => expect(screen.getByLabelText('Quick notes')).toHaveValue('Live quick note'))
  })

  it('reruns UI settings without rerunning Subjects for onboarding dismissal and restart', async () => {
    const user = userEvent.setup()
    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const uiSpy = vi.spyOn(uiSettingsRead, 'getUiSettings')

    render(<App />)
    await screen.findByRole('region', { name: 'Your first study loop' })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(uiSpy).toHaveBeenCalled())

    const shellBeforeDismiss = shellSpy.mock.calls.length
    const uiBeforeDismiss = uiSpy.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Hide checklist' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Your first study loop' })).not.toBeInTheDocument())
    await waitFor(() => expect(uiSpy.mock.calls.length).toBeGreaterThan(uiBeforeDismiss))
    expect(shellSpy.mock.calls.length).toBe(shellBeforeDismiss)

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const shellBeforeShow = shellSpy.mock.calls.length
    const uiBeforeShow = uiSpy.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Show onboarding checklist' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Onboarding checklist will appear on Home.'))
    await waitFor(() => expect(uiSpy.mock.calls.length).toBeGreaterThan(uiBeforeShow))
    expect(shellSpy.mock.calls.length).toBe(shellBeforeShow)

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('region', { name: 'Your first study loop' })).toBeInTheDocument()
  })

  it('reruns Goals and UI settings without Subjects for a qualifying daily study-time Goal', async () => {
    const user = userEvent.setup()
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 100 })
    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const uiSpy = vi.spyOn(uiSettingsRead, 'getUiSettings')
    const goalsSpy = vi.spyOn(goalRead, 'listGoals')

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await screen.findByRole('heading', { name: 'Goals' })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(uiSpy).toHaveBeenCalled())
    await waitFor(() => expect(goalsSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const uiBefore = uiSpy.mock.calls.length
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
    await waitFor(() => expect(uiSpy.mock.calls.length).toBeGreaterThan(uiBefore))
    expect(shellSpy.mock.calls.length).toBe(shellBefore)

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(screen.getByText(/0m of 1h 15m/i)).toBeInTheDocument()
  })

  it('does not rerun UI settings for non-qualifying Goal write, delete, or transition away', async () => {
    const user = userEvent.setup()
    const goal = await createGoal({
      title: 'Daily study keep',
      target: 60,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
    })
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 60 })

    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const uiSpy = vi.spyOn(uiSettingsRead, 'getUiSettings')
    const goalsSpy = vi.spyOn(goalRead, 'listGoals')

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await screen.findByRole('heading', { name: 'Goals' })
    await waitFor(() => expect(uiSpy).toHaveBeenCalled())
    await waitFor(() => expect(goalsSpy).toHaveBeenCalled())
    const uiBefore = uiSpy.mock.calls.length
    const shellBefore = shellSpy.mock.calls.length
    const goalsBefore = goalsSpy.mock.calls.length

    await createGoal({
      title: 'Manual only',
      target: 40,
      progress: 0,
      period: 'weekly',
      metric: 'manual',
    })
    await waitFor(() => expect(goalsSpy.mock.calls.length).toBeGreaterThan(goalsBefore))
    expect(uiSpy.mock.calls.length).toBe(uiBefore)
    expect(shellSpy.mock.calls.length).toBe(shellBefore)

    const goalsAfterManual = goalsSpy.mock.calls.length
    await updateGoal(goal.id, {
      title: 'Now weekly study',
      target: 90,
      progress: 0,
      period: 'weekly',
      metric: 'study_time',
    })
    await waitFor(() => expect(goalsSpy.mock.calls.length).toBeGreaterThan(goalsAfterManual))
    expect(uiSpy.mock.calls.length).toBe(uiBefore)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(60)

    const goalsAfterTransition = goalsSpy.mock.calls.length
    await deleteGoal(goal.id)
    await waitFor(() => expect(goalsSpy.mock.calls.length).toBeGreaterThan(goalsAfterTransition))
    expect(uiSpy.mock.calls.length).toBe(uiBefore)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(60)
  })

  it('does not rerun UI settings or Subjects for active-focus create/update/cleanup', async () => {
    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const uiSpy = vi.spyOn(uiSettingsRead, 'getUiSettings')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(uiSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const uiBefore = uiSpy.mock.calls.length

    const created = await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-ui-iso',
      subjectId: '',
      plannedMinutes: 25,
    }))
    expect(created.ok).toBe(true)
    await waitFor(async () => {
      expect(await getActiveFocusSession()).not.toBeNull()
    })
    expect(uiSpy.mock.calls.length).toBe(uiBefore)
    expect(shellSpy.mock.calls.length).toBe(shellBefore)

    await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: { broken: true } })
    await waitFor(async () => {
      expect(await getActiveFocusSession()).toBeNull()
    })
    expect(uiSpy.mock.calls.length).toBe(uiBefore)
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
  })

  it('reruns Sessions on focus finalization without UI settings or Subjects', async () => {
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-focus-ui',
      name: 'Chemistry',
      color: '#0f766e',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const uiSpy = vi.spyOn(uiSettingsRead, 'getUiSettings')
    const sessionsSpy = vi.spyOn(studySessionRead, 'listStudySessions')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(uiSpy).toHaveBeenCalled())
    await waitFor(() => expect(sessionsSpy).toHaveBeenCalled())

    await user.selectOptions(screen.getByLabelText('Focus subject'), 'subject-focus-ui')
    await waitForFocusStartEnabled()
    const shellBefore = shellSpy.mock.calls.length
    const uiBefore = uiSpy.mock.calls.length
    const sessionsBefore = sessionsSpy.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Start focus' }))
    expect(await screen.findByText('Elapsed')).toBeInTheDocument()
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
    expect(uiSpy.mock.calls.length).toBe(uiBefore)
    expect(sessionsSpy.mock.calls.length).toBe(sessionsBefore)

    await user.click(screen.getByRole('button', { name: 'Stop session' }))
    await waitFor(async () => {
      expect(await studyDb.studySessions.count()).toBe(1)
      expect(await getActiveFocusSession()).toBeNull()
    })
    await waitFor(() => expect(sessionsSpy.mock.calls.length).toBeGreaterThan(sessionsBefore))
    expect(uiSpy.mock.calls.length).toBe(uiBefore)
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
    expect(await screen.findByRole('button', { name: 'Start focus' })).toBeInTheDocument()
  })

  it('does not rerun UI settings or Subjects for migration-marker or unknown-key writes', async () => {
    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const uiSpy = vi.spyOn(uiSettingsRead, 'getUiSettings')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(uiSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const uiBefore = uiSpy.mock.calls.length

    await studyDb.settings.put({ key: 'legacy-localstorage-migrated-v1', value: true })
    await studyDb.settings.put({ key: 'plugin.future.setting', value: { ok: true } })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40))
    })

    expect(uiSpy.mock.calls.length).toBe(uiBefore)
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
  })

  it('reruns Subjects without UI settings for Subject writes', async () => {
    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const uiSpy = vi.spyOn(uiSettingsRead, 'getUiSettings')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(uiSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const uiBefore = uiSpy.mock.calls.length

    await createSubject({
      name: 'New subject only',
      color: '#2563eb',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
    })

    await waitFor(() => expect(shellSpy.mock.calls.length).toBeGreaterThan(shellBefore))
    expect(uiSpy.mock.calls.length).toBe(uiBefore)
  })

  it('does not rerun UI settings for Task, Note, Event, or manual session writes', async () => {
    const uiSpy = vi.spyOn(uiSettingsRead, 'getUiSettings')
    const tasksSpy = vi.spyOn(taskRead, 'listTasks')
    const notesSpy = vi.spyOn(noteRead, 'listNotes')
    const eventsSpy = vi.spyOn(calendarEventRead, 'listCalendarEvents')
    const sessionsSpy = vi.spyOn(studySessionRead, 'listStudySessions')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(uiSpy).toHaveBeenCalled())
    await waitFor(() => expect(tasksSpy).toHaveBeenCalled())
    const uiBaseline = uiSpy.mock.calls.length
    const tasksBefore = tasksSpy.mock.calls.length
    const notesBefore = notesSpy.mock.calls.length
    const eventsBefore = eventsSpy.mock.calls.length
    const sessionsBefore = sessionsSpy.mock.calls.length

    await createTask({
      title: 'Unrelated task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      minutes: 20,
    })
    await waitFor(() => expect(tasksSpy.mock.calls.length).toBeGreaterThan(tasksBefore))
    expect(uiSpy.mock.calls.length).toBe(uiBaseline)

    await createNote({
      title: 'Unrelated note',
      body: 'body',
      subjectId: '',
      tags: [],
    })
    await waitFor(() => expect(notesSpy.mock.calls.length).toBeGreaterThan(notesBefore))
    expect(uiSpy.mock.calls.length).toBe(uiBaseline)

    await createCalendarEvent({
      title: 'Unrelated event',
      subjectId: '',
      startAt: '2026-07-10T10:00:00.000Z',
      endAt: '2026-07-10T11:00:00.000Z',
      location: '',
    })
    await waitFor(() => expect(eventsSpy.mock.calls.length).toBeGreaterThan(eventsBefore))
    expect(uiSpy.mock.calls.length).toBe(uiBaseline)

    await createStudySession({
      subjectId: '',
      startedAt: '2026-07-02T09:00:00.000Z',
      endedAt: '2026-07-02T09:30:00.000Z',
      minutes: 30,
      note: '',
    })
    await waitFor(() => expect(sessionsSpy.mock.calls.length).toBeGreaterThan(sessionsBefore))
    expect(uiSpy.mock.calls.length).toBe(uiBaseline)
  })

  it('updates UI settings after import without a page reload and keeps full settings in getStudyData', async () => {
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 200 })
    await studyDb.settings.put({ key: 'quickNotes', value: ['before import'] })
    await studyDb.settings.put({ key: 'plugin.future.setting', value: { keep: true } })

    const uiSpy = vi.spyOn(uiSettingsRead, 'getUiSettings')
    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(uiSpy).toHaveBeenCalled())
    const uiBefore = uiSpy.mock.calls.length

    expect(screen.getByLabelText('Quick notes')).toHaveValue('before import')

    const payload = makeEmptyExport({
      settings: [
        { key: 'dailyGoalMinutes', value: 90 },
        { key: 'quickNotes', value: ['imported line'] },
        { key: 'onboardingChecklistDismissed', value: true },
        { key: 'plugin.future.setting', value: { keep: true, n: 2 } },
        { key: 'legacy-localstorage-migrated-v1', value: true },
      ],
    })
    await importStudyData(payload)

    await waitFor(() => expect(uiSpy.mock.calls.length).toBeGreaterThan(uiBefore))
    await waitFor(async () => {
      expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(90)
      expect((await studyDb.settings.get('quickNotes'))?.value).toEqual(['imported line'])
      expect((await studyDb.settings.get('onboardingChecklistDismissed'))?.value).toBe(true)
      expect((await studyDb.settings.get('plugin.future.setting'))?.value).toEqual({ keep: true, n: 2 })
    })
    await waitFor(() => {
      expect(screen.getByLabelText('Quick notes')).toHaveValue('imported line')
    })
    expect(screen.getByText(/0m of 1h 30m/i)).toBeInTheDocument()

    const full = await getStudyData()
    expect(full.settings.map((row) => row.key).sort()).toEqual([
      'dailyGoalMinutes',
      'legacy-localstorage-migrated-v1',
      'onboardingChecklistDismissed',
      'plugin.future.setting',
      'quickNotes',
    ].sort())
    expect(full.settings.find((row) => row.key === 'plugin.future.setting')?.value).toEqual({ keep: true, n: 2 })
    expect((await exportStudyData()).settings).toEqual(
      full.settings.filter((row) => row.key !== 'legacy-localstorage-migrated-v1')
    )
  })

  it('clear-all deletes Quick Notes, preserves daily goal, refreshes UI settings and Subjects', async () => {
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 180 })
    await studyDb.settings.put({ key: 'quickNotes', value: ['clear me'] })
    await studyDb.settings.put({ key: 'onboardingChecklistDismissed', value: true })
    await studyDb.settings.put({ key: 'legacy-localstorage-migrated-v1', value: true })
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

    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const uiSpy = vi.spyOn(uiSettingsRead, 'getUiSettings')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    expect(screen.getByLabelText('Quick notes')).toHaveValue('clear me')
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(uiSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const uiBefore = uiSpy.mock.calls.length

    await clearAllStudyData()

    await waitFor(async () => {
      expect(await studyDb.settings.get('quickNotes')).toBeUndefined()
      expect(await studyDb.settings.get('onboardingChecklistDismissed')).toBeUndefined()
      expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(180)
      expect(await studyDb.subjects.count()).toBe(0)
    })
    await waitFor(() => expect(uiSpy.mock.calls.length).toBeGreaterThan(uiBefore))
    await waitFor(() => expect(shellSpy.mock.calls.length).toBeGreaterThan(shellBefore))
    await waitFor(() => {
      expect(screen.getByLabelText('Quick notes')).toHaveValue('')
    })
    expect(screen.getByRole('region', { name: 'Your first study loop' })).toBeInTheDocument()
    expect(screen.getByText(/0m of 3h/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
  })

  it('waits for UI settings before first paint so seeded values do not flash defaults', async () => {
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 90 })
    await studyDb.settings.put({ key: 'quickNotes', value: ['seeded note'] })

    let release!: (value: uiSettingsRead.UiSettings) => void
    const gate = new Promise<uiSettingsRead.UiSettings>((resolve) => {
      release = resolve
    })
    const original = uiSettingsRead.getUiSettings
    vi.spyOn(uiSettingsRead, 'getUiSettings').mockImplementation(() => gate)

    render(<App />)
    expect(screen.queryByRole('heading', { name: /Good (morning|afternoon|evening)/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Loading your study space/i)).toBeInTheDocument()

    await act(async () => {
      release(await original())
    })

    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Quick notes')).toHaveValue('seeded note')
    expect(screen.getByText(/0m of 1h 30m/i)).toBeInTheDocument()
  })
})
