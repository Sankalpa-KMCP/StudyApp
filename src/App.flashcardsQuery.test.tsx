import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as subjectRead from './db/subjectRead'
import * as calendarEventRead from './db/calendarEventRead'
import { createCalendarEvent } from './db/calendarEventService'
import * as flashcardRead from './db/flashcardRead'
import {
  createFlashcard,
  deleteFlashcard,
  reviewFlashcard,
  updateFlashcard,
} from './db/flashcardService'
import * as goalRead from './db/goalRead'
import { createGoal } from './db/goalService'
import { createNote } from './db/notesService'
import * as noteRead from './db/noteRead'
import { createTask } from './db/taskService'
import * as taskRead from './db/taskRead'
import { saveQuickNotes } from './db/quickNotesService'
import { createStudySession } from './db/studySessionService'
import * as studySessionRead from './db/studySessionRead'
import { exportStudyData, getStudyData, studyDb } from './db/studyDb'
import { getMillisecondsUntilNextLocalMidnight } from './hooks/useCurrentDate'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'

describe('App flashcards live query isolation', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('reruns Flashcards without rerunning the Subjects query for card writes and updates consumers', async () => {
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-cards',
      name: 'Chemistry',
      color: '#2563eb',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const flashcardsSpy = vi.spyOn(flashcardRead, 'listFlashcards')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(flashcardsSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const flashcardsBefore = flashcardsSpy.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Flashcards' }))
    await user.click(screen.getByRole('button', { name: 'New card' }))
    await user.type(screen.getByLabelText('Front'), 'Isolation front')
    await user.type(screen.getByLabelText('Back'), 'Isolation back')
    await user.selectOptions(screen.getByLabelText('Subject'), 'subject-cards')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Isolation front')).toBeInTheDocument()

    await waitFor(() => expect(flashcardsSpy.mock.calls.length).toBeGreaterThan(flashcardsBefore))
    expect(shellSpy.mock.calls.length).toBe(shellBefore)

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    const reviewSection = screen.getByText('Review Queue').closest('section') as HTMLElement
    expect(within(reviewSection).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Study pulse')).getByText('1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Subjects' }))
    const subjectCard = (await screen.findByText('Chemistry')).closest('article') as HTMLElement
    expect(within(subjectCard).getByText(/1 linked records/i)).toBeInTheDocument()
  }, 15_000)

  it('does not rerun Flashcards for unrelated task or study-session writes', async () => {
    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const flashcardsSpy = vi.spyOn(flashcardRead, 'listFlashcards')
    const tasksSpy = vi.spyOn(taskRead, 'listTasks')
    const sessionsSpy = vi.spyOn(studySessionRead, 'listStudySessions')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(flashcardsSpy).toHaveBeenCalled())
    await waitFor(() => expect(tasksSpy).toHaveBeenCalled())
    await waitFor(() => expect(sessionsSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const flashcardsBefore = flashcardsSpy.mock.calls.length
    const tasksBefore = tasksSpy.mock.calls.length
    const sessionsBefore = sessionsSpy.mock.calls.length

    await createTask({
      title: 'Unrelated task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      minutes: 20,
    })

    await waitFor(() => expect(tasksSpy.mock.calls.length).toBeGreaterThan(tasksBefore))
    expect(flashcardsSpy.mock.calls.length).toBe(flashcardsBefore)
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
    expect(sessionsSpy.mock.calls.length).toBe(sessionsBefore)

    const shellAfterTask = shellSpy.mock.calls.length
    const flashcardsAfterTask = flashcardsSpy.mock.calls.length
    const sessionsAfterTask = sessionsSpy.mock.calls.length

    await createStudySession({
      subjectId: '',
      startedAt: '2026-07-02T09:00:00.000Z',
      endedAt: '2026-07-02T09:30:00.000Z',
      minutes: 30,
      note: 'manual',
    })

    await waitFor(() => expect(sessionsSpy.mock.calls.length).toBeGreaterThan(sessionsAfterTask))
    expect(shellSpy.mock.calls.length).toBe(shellAfterTask)
    expect(flashcardsSpy.mock.calls.length).toBe(flashcardsAfterTask)
  })

  it('does not rerun Flashcards for Note writes', async () => {
    const notesSpy = vi.spyOn(noteRead, 'listNotes')
    const flashcardsSpy = vi.spyOn(flashcardRead, 'listFlashcards')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(notesSpy).toHaveBeenCalled())
    await waitFor(() => expect(flashcardsSpy).toHaveBeenCalled())
    const notesBefore = notesSpy.mock.calls.length
    const flashcardsBefore = flashcardsSpy.mock.calls.length

    await createNote({
      title: 'Unrelated note',
      body: 'body',
      subjectId: '',
      tags: [],
    })

    await waitFor(() => expect(notesSpy.mock.calls.length).toBeGreaterThan(notesBefore))
    expect(flashcardsSpy.mock.calls.length).toBe(flashcardsBefore)
  })

  it('does not rerun Flashcards for Calendar event writes', async () => {
    const eventsSpy = vi.spyOn(calendarEventRead, 'listCalendarEvents')
    const flashcardsSpy = vi.spyOn(flashcardRead, 'listFlashcards')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(eventsSpy).toHaveBeenCalled())
    await waitFor(() => expect(flashcardsSpy).toHaveBeenCalled())
    const eventsBefore = eventsSpy.mock.calls.length
    const flashcardsBefore = flashcardsSpy.mock.calls.length

    await createCalendarEvent({
      title: 'Unrelated event',
      subjectId: '',
      startAt: '2026-07-10T10:00:00.000Z',
      endAt: '2026-07-10T11:00:00.000Z',
      location: '',
    })

    await waitFor(() => expect(eventsSpy.mock.calls.length).toBeGreaterThan(eventsBefore))
    expect(flashcardsSpy.mock.calls.length).toBe(flashcardsBefore)
  })

  it('does not rerun Flashcards for a Goal-only write', async () => {
    const user = userEvent.setup()
    const flashcardsSpy = vi.spyOn(flashcardRead, 'listFlashcards')
    const goalsSpy = vi.spyOn(goalRead, 'listGoals')

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await screen.findByRole('heading', { name: 'Goals' })
    await waitFor(() => expect(flashcardsSpy).toHaveBeenCalled())
    await waitFor(() => expect(goalsSpy).toHaveBeenCalled())
    const flashcardsBefore = flashcardsSpy.mock.calls.length
    const goalsBefore = goalsSpy.mock.calls.length

    await createGoal({
      title: 'Manual goal only',
      target: 30,
      progress: 0,
      period: 'weekly',
      metric: 'manual',
    })

    await waitFor(() => expect(goalsSpy.mock.calls.length).toBeGreaterThan(goalsBefore))
    expect(flashcardsSpy.mock.calls.length).toBe(flashcardsBefore)
  })

  it('does not rerun Flashcards for Quick Notes settings writes', async () => {
    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const flashcardsSpy = vi.spyOn(flashcardRead, 'listFlashcards')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(flashcardsSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const flashcardsBefore = flashcardsSpy.mock.calls.length

    await saveQuickNotes('Quick line one')

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40))
    })
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
    expect(flashcardsSpy.mock.calls.length).toBe(flashcardsBefore)
  })

  it('refreshes Flashcards after Dexie clear and restore without a page reload', async () => {
    const user = userEvent.setup()
    const created = await createFlashcard({
      front: 'Restore me',
      back: 'persisted',
      subjectId: '',
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Flashcards' }))
    expect(await screen.findByText('Restore me')).toBeInTheDocument()

    const snapshot = await exportStudyData()
    expect(snapshot.flashcards.map((card) => card.front)).toContain('Restore me')

    await studyDb.flashcards.clear()
    await waitFor(() => expect(screen.getByText('No flashcards yet')).toBeInTheDocument())

    await studyDb.flashcards.bulkPut(snapshot.flashcards)
    expect(await screen.findByText('Restore me')).toBeInTheDocument()
    expect(created.id).toBe(snapshot.flashcards[0]?.id)
  })

  it('keeps full getStudyData / export snapshots including Flashcards', async () => {
    await createFlashcard({
      front: 'Export card',
      back: 'full snapshot',
      subjectId: '',
    })
    const full = await getStudyData()
    const exported = await exportStudyData()
    expect(full.flashcards).toHaveLength(1)
    expect(full.flashcards[0]?.front).toBe('Export card')
    expect(exported.flashcards).toEqual(full.flashcards)
    expect(exported.version).toBe(3)
  })

  it('updates Flashcards after review without shell Flashcards reads and keeps reveal independent', async () => {
    const created = await createFlashcard({
      front: 'Review me',
      back: 'Answer body',
      subjectId: '',
    })

    const user = userEvent.setup()
    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const flashcardsSpy = vi.spyOn(flashcardRead, 'listFlashcards')

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Flashcards' }))
    expect(await screen.findByText('Review me')).toBeInTheDocument()
    expect(screen.getByText('Answer hidden')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(screen.getByText('Answer body')).toBeInTheDocument()

    const shellBefore = shellSpy.mock.calls.length
    const flashcardsBefore = flashcardsSpy.mock.calls.length
    await reviewFlashcard(created, 'remembered')

    await waitFor(() => expect(flashcardsSpy.mock.calls.length).toBeGreaterThan(flashcardsBefore))
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
    expect(await screen.findByText('remembered')).toBeInTheDocument()
    expect(screen.getByText('Answer body')).toBeInTheDocument()

    await updateFlashcard(created.id, {
      front: 'Review me updated',
      back: 'Answer body',
      subjectId: '',
    })
    expect(await screen.findByText('Review me updated')).toBeInTheDocument()

    await deleteFlashcard(created.id)
    await waitFor(() => expect(screen.queryByText('Review me updated')).not.toBeInTheDocument())
  })

  it('preserves existing Review Queue due-memo behaviour across local midnight without Flashcards rerun', async () => {
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

    // Becomes due at local midnight; before midnight it is not due.
    await studyDb.flashcards.add({
      id: 'card-due-at-midnight',
      front: 'Due at midnight',
      back: 'answer',
      subjectId: '',
      status: 'learning',
      lastReviewedAt: '',
      dueAt: new Date(2026, 6, 14, 0, 0, 0, 0).toISOString(),
      createdAt: new Date(2026, 6, 13, 8, 0).toISOString(),
      updatedAt: new Date(2026, 6, 13, 8, 0).toISOString(),
    })

    const flashcardsSpy = vi.spyOn(flashcardRead, 'listFlashcards')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(flashcardsSpy).toHaveBeenCalled())
    expect(midnightCallbacks).toHaveLength(1)
    expect(getMillisecondsUntilNextLocalMidnight(beforeMidnight)).toBeGreaterThan(0)

    const reviewSection = screen.getByText('Review Queue').closest('section') as HTMLElement
    expect(within(reviewSection).getByText('0')).toBeInTheDocument()
    const flashcardsBefore = flashcardsSpy.mock.calls.length
    const cardCountBefore = await studyDb.flashcards.count()

    const afterMidnight = new Date(2026, 6, 14, 0, 0, 0, 0)
    vi.setSystemTime(afterMidnight)
    await act(async () => {
      midnightCallbacks[0]!()
    })

    // Existing asymmetry: App dueCards memo does not depend on currentDate, so Review Queue stays 0
    // even though wall clock has crossed dueAt — without a Flashcards-table write or query rerun.
    expect(within(reviewSection).getByText('0')).toBeInTheDocument()
    expect(flashcardsSpy.mock.calls.length).toBe(flashcardsBefore)
    expect(await studyDb.flashcards.count()).toBe(cardCountBefore)
  })
})
