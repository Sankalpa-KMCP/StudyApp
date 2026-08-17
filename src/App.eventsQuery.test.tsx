import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as appShellRead from './db/appShellRead'
import * as calendarEventRead from './db/calendarEventRead'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from './db/calendarEventService'
import * as goalRead from './db/goalRead'
import { createGoal } from './db/goalService'
import { createNote } from './db/notesService'
import * as noteRead from './db/noteRead'
import { createTask } from './db/taskService'
import { saveQuickNotes } from './db/quickNotesService'
import { createStudySession } from './db/studySessionService'
import { exportStudyData, getStudyData, studyDb } from './db/studyDb'
import { getMillisecondsUntilNextLocalMidnight } from './hooks/useCurrentDate'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'

describe('App events live query isolation', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('reruns Events without rerunning the App shell for event writes and updates consumers', async () => {
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-events',
      name: 'Physics',
      color: '#2563eb',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    const shellSpy = vi.spyOn(appShellRead, 'getAppShellData')
    const eventsSpy = vi.spyOn(calendarEventRead, 'listCalendarEvents')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(eventsSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const eventsBefore = eventsSpy.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Calendar' }))
    await user.click(screen.getByRole('button', { name: 'New event' }))
    await user.type(screen.getByLabelText('Event title'), 'Isolation lab')
    await user.selectOptions(screen.getByLabelText('Subject'), 'subject-events')
    await user.type(screen.getByLabelText('Location'), 'Lab 2')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Isolation lab')).toBeInTheDocument()

    await waitFor(() => expect(eventsSpy.mock.calls.length).toBeGreaterThan(eventsBefore))
    expect(shellSpy.mock.calls.length).toBe(shellBefore)

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    const rightColumn = screen.getByRole('complementary', { name: 'Progress and schedule' })
    expect(within(rightColumn).getByText('Isolation lab')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Subjects' }))
    const subjectCard = (await screen.findByText('Physics')).closest('article') as HTMLElement
    expect(within(subjectCard).getByText(/1 linked records/i)).toBeInTheDocument()
  })

  it('does not rerun Events for unrelated task or study-session writes', async () => {
    const shellSpy = vi.spyOn(appShellRead, 'getAppShellData')
    const eventsSpy = vi.spyOn(calendarEventRead, 'listCalendarEvents')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(eventsSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const eventsBefore = eventsSpy.mock.calls.length

    await createTask({
      title: 'Unrelated task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      minutes: 20,
    })

    await waitFor(() => expect(shellSpy.mock.calls.length).toBeGreaterThan(shellBefore))
    expect(eventsSpy.mock.calls.length).toBe(eventsBefore)

    const shellAfterTask = shellSpy.mock.calls.length
    const eventsAfterTask = eventsSpy.mock.calls.length

    await createStudySession({
      subjectId: '',
      startedAt: '2026-07-02T09:00:00.000Z',
      endedAt: '2026-07-02T09:30:00.000Z',
      minutes: 30,
      note: 'manual',
    })

    await waitFor(() => expect(shellSpy.mock.calls.length).toBeGreaterThan(shellAfterTask))
    expect(eventsSpy.mock.calls.length).toBe(eventsAfterTask)
  })

  it('does not rerun Events for Note writes', async () => {
    const notesSpy = vi.spyOn(noteRead, 'listNotes')
    const eventsSpy = vi.spyOn(calendarEventRead, 'listCalendarEvents')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(notesSpy).toHaveBeenCalled())
    await waitFor(() => expect(eventsSpy).toHaveBeenCalled())
    const notesBefore = notesSpy.mock.calls.length
    const eventsBefore = eventsSpy.mock.calls.length

    await createNote({
      title: 'Unrelated note',
      body: 'body',
      subjectId: '',
      tags: [],
    })

    await waitFor(() => expect(notesSpy.mock.calls.length).toBeGreaterThan(notesBefore))
    expect(eventsSpy.mock.calls.length).toBe(eventsBefore)
  })

  it('does not rerun Events for a Goal-only write', async () => {
    const user = userEvent.setup()
    const eventsSpy = vi.spyOn(calendarEventRead, 'listCalendarEvents')
    const goalsSpy = vi.spyOn(goalRead, 'listGoals')

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await screen.findByRole('heading', { name: 'Goals' })
    await waitFor(() => expect(eventsSpy).toHaveBeenCalled())
    await waitFor(() => expect(goalsSpy).toHaveBeenCalled())
    const eventsBefore = eventsSpy.mock.calls.length
    const goalsBefore = goalsSpy.mock.calls.length

    await createGoal({
      title: 'Manual goal only',
      target: 30,
      progress: 0,
      period: 'weekly',
      metric: 'manual',
    })

    await waitFor(() => expect(goalsSpy.mock.calls.length).toBeGreaterThan(goalsBefore))
    expect(eventsSpy.mock.calls.length).toBe(eventsBefore)
  })

  it('does not rerun Events for Quick Notes settings writes', async () => {
    const shellSpy = vi.spyOn(appShellRead, 'getAppShellData')
    const eventsSpy = vi.spyOn(calendarEventRead, 'listCalendarEvents')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(eventsSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const eventsBefore = eventsSpy.mock.calls.length

    await saveQuickNotes('Quick line one')

    await waitFor(() => expect(shellSpy.mock.calls.length).toBeGreaterThan(shellBefore))
    expect(eventsSpy.mock.calls.length).toBe(eventsBefore)
  })

  it('refreshes Events after Dexie clear and restore without a page reload', async () => {
    const user = userEvent.setup()
    const created = await createCalendarEvent({
      title: 'Restore me',
      subjectId: '',
      startAt: '2026-07-10T10:00:00.000Z',
      endAt: '2026-07-10T11:00:00.000Z',
      location: '',
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Calendar' }))
    expect(await screen.findByText('Restore me')).toBeInTheDocument()

    const snapshot = await exportStudyData()
    expect(snapshot.events.map((event) => event.title)).toContain('Restore me')

    await studyDb.events.clear()
    await waitFor(() => expect(screen.getByText('No events scheduled')).toBeInTheDocument())

    await studyDb.events.bulkPut(snapshot.events)
    expect(await screen.findByText('Restore me')).toBeInTheDocument()
    expect(created.id).toBe(snapshot.events[0]?.id)
  })

  it('keeps full getStudyData / export snapshots including Events', async () => {
    await createCalendarEvent({
      title: 'Export event',
      subjectId: '',
      startAt: '2026-07-11T10:00:00.000Z',
      endAt: '2026-07-11T11:00:00.000Z',
      location: 'Hall',
    })
    const full = await getStudyData()
    const exported = await exportStudyData()
    expect(full.events).toHaveLength(1)
    expect(full.events[0]?.title).toBe('Export event')
    expect(exported.events).toEqual(full.events)
    expect(exported.version).toBe(3)
  })

  it('updates Calendar list order after event updates without shell Events reads', async () => {
    const earlier = await createCalendarEvent({
      title: 'Earlier slot',
      subjectId: '',
      startAt: '2026-07-20T09:00:00.000Z',
      endAt: '2026-07-20T10:00:00.000Z',
      location: '',
    })
    await createCalendarEvent({
      title: 'Later slot',
      subjectId: '',
      startAt: '2026-07-21T09:00:00.000Z',
      endAt: '2026-07-21T10:00:00.000Z',
      location: '',
    })

    const user = userEvent.setup()
    const shellSpy = vi.spyOn(appShellRead, 'getAppShellData')
    const eventsSpy = vi.spyOn(calendarEventRead, 'listCalendarEvents')

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Calendar' }))
    expect(await screen.findByText('Earlier slot')).toBeInTheDocument()

    const shellBefore = shellSpy.mock.calls.length
    const eventsBefore = eventsSpy.mock.calls.length
    await updateCalendarEvent(earlier.id, {
      title: 'Earlier slot bumped late',
      subjectId: '',
      startAt: '2026-07-22T09:00:00.000Z',
      endAt: '2026-07-22T10:00:00.000Z',
      location: '',
    })

    await waitFor(() => expect(eventsSpy.mock.calls.length).toBeGreaterThan(eventsBefore))
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
    await waitFor(() => {
      const titles = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent)
      expect(titles.indexOf('Later slot')).toBeLessThan(titles.indexOf('Earlier slot bumped late'))
    })

    await deleteCalendarEvent(earlier.id)
    await waitFor(() => expect(screen.queryByText('Earlier slot bumped late')).not.toBeInTheDocument())
  })

  it('recalculates Upcoming after local midnight without rerunning the Events query', async () => {
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

    await studyDb.events.add({
      id: 'event-rollover-morning',
      title: 'Morning review',
      subjectId: '',
      startAt: new Date(2026, 6, 13, 9, 0).toISOString(),
      endAt: new Date(2026, 6, 13, 10, 0).toISOString(),
      location: '',
      createdAt: new Date(2026, 6, 13, 8, 0).toISOString(),
      updatedAt: new Date(2026, 6, 13, 8, 0).toISOString(),
    })

    const eventsSpy = vi.spyOn(calendarEventRead, 'listCalendarEvents')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(eventsSpy).toHaveBeenCalled())
    expect(midnightCallbacks).toHaveLength(1)
    expect(getMillisecondsUntilNextLocalMidnight(beforeMidnight)).toBeGreaterThan(0)

    const rightColumn = screen.getByRole('complementary', { name: 'Progress and schedule' })
    expect(within(rightColumn).getByText('Morning review')).toBeInTheDocument()
    const eventsBefore = eventsSpy.mock.calls.length
    const eventCountBefore = await studyDb.events.count()

    const afterMidnight = new Date(2026, 6, 14, 0, 0, 0, 0)
    vi.setSystemTime(afterMidnight)
    await act(async () => {
      midnightCallbacks[0]!()
    })

    expect(within(rightColumn).queryByText('Morning review')).not.toBeInTheDocument()
    expect(eventsSpy.mock.calls.length).toBe(eventsBefore)
    expect(await studyDb.events.count()).toBe(eventCountBefore)
  })
})
