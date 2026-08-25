import { beforeEach, describe, expect, it } from 'vitest'
import {
  createActiveFocusSession,
  discardActiveFocusSession,
  finalizeActiveFocusSession,
  pauseActiveFocusSession,
  resumeActiveFocusSession,
  updateActiveFocusSession,
} from './activeFocusSession'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from './calendarEventService'
import { installInMemoryLockAdapter } from './crossTabLock'
import { StaleDatabaseGenerationError } from './databaseGeneration'
import { captureDatabaseGeneration } from './databaseMutationGuard'
import { createGoal, deleteGoal, updateGoal } from './goalService'
import { createNote, deleteNote, updateNote } from './notesService'
import { saveQuickNotes } from './quickNotesService'
import {
  clearAllStudyData,
  importStudyData,
  studyDb,
} from './studyDb'
import {
  createStudySession,
  deleteStudySession,
  updateStudySession,
} from './studySessionService'
import {
  createSubject,
  deleteSubject,
  updateSubject,
} from './subjectService'
import {
  createTask,
  deleteTask,
  setTaskStatus,
  updateTask,
} from './taskService'

describe('Stale writer protection across all domain entities', () => {
  beforeEach(async () => {
    installInMemoryLockAdapter()
    await studyDb.delete()
    await studyDb.open()
  })

  it('rejects stale Task writers after clearAllStudyData advances generation', async () => {
    const gen = await captureDatabaseGeneration()
    const task = await createTask(
      {
        title: 'Initial task',
        subjectId: '',
        status: 'open',
        priority: 'normal',
        minutes: 30,
        dueDate: '',
      },
      { expectedGeneration: gen },
    )

    // Destructive operation advances generation
    await clearAllStudyData()
    expect(await captureDatabaseGeneration()).toBeGreaterThan(gen)

    // Stale writer using older generation fails closed
    await expect(
      updateTask(task.id, { title: 'Resurrected task' }, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      setTaskStatus(task.id, 'done', { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      deleteTask(task.id, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      createTask(
        {
          title: 'Zombie task',
          subjectId: '',
          status: 'open',
          priority: 'normal',
          minutes: 30,
          dueDate: '',
        },
        { expectedGeneration: gen },
      ),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    expect(await studyDb.tasks.count()).toBe(0)
  })

  it('rejects stale Note writers after importStudyData advances generation', async () => {
    const gen = await captureDatabaseGeneration()
    const note = await createNote(
      {
        title: 'Initial note',
        body: 'Initial body',
        subjectId: '',
        tags: ['tag1'],
      },
      { expectedGeneration: gen },
    )

    // Import operation advances generation
    const importPayload = {
      version: 4,
      exportedAt: new Date().toISOString(),
      subjects: [],
      tasks: [],
      notes: [],
      events: [],
      studySessions: [],
      goals: [],
      settings: [],
    }
    await importStudyData(JSON.stringify(importPayload))
    expect(await captureDatabaseGeneration()).toBeGreaterThan(gen)

    await expect(
      updateNote(note.id, { title: 'Zombie note update' }, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      deleteNote(note.id, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      createNote(
        {
          title: 'Zombie note',
          body: '',
          subjectId: '',
          tags: [],
        },
        { expectedGeneration: gen },
      ),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    expect(await studyDb.notes.count()).toBe(0)
  })

  it('rejects stale Subject writers after clearAllStudyData', async () => {
    const gen = await captureDatabaseGeneration()
    const subject = await createSubject(
      {
        name: 'Math',
        color: '#111827',
        targetHours: 20,
        progress: 0,
        progressMode: 'manual',
      },
      { expectedGeneration: gen },
    )

    await clearAllStudyData()

    await expect(
      updateSubject(subject.id, { name: 'Resurrected Math' }, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      deleteSubject(subject.id, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      createSubject(
        {
          name: 'Physics',
          color: '#111827',
          targetHours: 10,
          progress: 0,
          progressMode: 'manual',
        },
        { expectedGeneration: gen },
      ),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    expect(await studyDb.subjects.count()).toBe(0)
  })

  it('rejects stale CalendarEvent writers after clearAllStudyData', async () => {
    const gen = await captureDatabaseGeneration()
    const event = await createCalendarEvent(
      {
        title: 'Exam',
        startAt: '2026-09-01T09:00:00.000Z',
        endAt: '2026-09-01T11:00:00.000Z',
        location: 'Hall 1',
        subjectId: '',
      },
      { expectedGeneration: gen },
    )

    await clearAllStudyData()

    await expect(
      updateCalendarEvent(event.id, { title: 'Zombie Exam' }, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      deleteCalendarEvent(event.id, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      createCalendarEvent(
        {
          title: 'Another Exam',
          startAt: '2026-09-01T12:00:00.000Z',
          endAt: '2026-09-01T13:00:00.000Z',
          location: '',
          subjectId: '',
        },
        { expectedGeneration: gen },
      ),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    expect(await studyDb.events.count()).toBe(0)
  })

  it('rejects stale StudySession writers after clearAllStudyData', async () => {
    const gen = await captureDatabaseGeneration()
    const session = await createStudySession(
      {
        subjectId: '',
        durationMinutes: 45,
        startedAt: '2026-09-01T09:00:00.000Z',
        endedAt: '2026-09-01T09:45:00.000Z',
        notes: 'Good session',
      },
      { expectedGeneration: gen },
    )

    await clearAllStudyData()

    await expect(
      updateStudySession(session.id, { notes: 'Zombie notes' }, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      deleteStudySession(session.id, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      createStudySession(
        {
          subjectId: '',
          durationMinutes: 30,
          startedAt: '2026-09-01T10:00:00.000Z',
          endedAt: '2026-09-01T10:30:00.000Z',
          notes: '',
        },
        { expectedGeneration: gen },
      ),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    expect(await studyDb.studySessions.count()).toBe(0)
  })

  it('rejects stale Goal writers after clearAllStudyData', async () => {
    const gen = await captureDatabaseGeneration()
    const goal = await createGoal(
      {
        title: 'Weekly 10 hours',
        period: 'weekly',
        target: 10,
        progress: 0,
        metric: 'manual',
      },
      { expectedGeneration: gen },
    )

    await clearAllStudyData()

    await expect(
      updateGoal(goal.id, { title: 'Zombie Goal' }, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      deleteGoal(goal.id, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      createGoal(
        {
          title: 'Daily Goal',
          period: 'daily',
          target: 60,
          progress: 0,
          metric: 'study_time',
        },
        { expectedGeneration: gen },
      ),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    expect(await studyDb.goals.count()).toBe(0)
  })

  it('rejects stale QuickNotes saves after clearAllStudyData', async () => {
    const gen = await captureDatabaseGeneration()
    await saveQuickNotes('Initial note', { expectedGeneration: gen })

    await clearAllStudyData()

    await expect(
      saveQuickNotes('Stale note write', { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    expect(await studyDb.settings.get('quickNotes')).toBeUndefined()
  })

  it('rejects stale ActiveFocusSession lifecycle transitions after clearAllStudyData', async () => {
    const focusSession = {
      id: 'focus-test-1',
      subjectId: '',
      plannedMinutes: 25,
      status: 'running' as const,
      startedAt: new Date().toISOString(),
      accumulatedPausedMs: 0,
      pausedAt: null,
    }
    const createResult = await createActiveFocusSession(focusSession)
    expect(createResult.ok).toBe(true)
    if (!createResult.ok) return

    const { session, generation: gen } = createResult

    await clearAllStudyData()

    await expect(
      pauseActiveFocusSession(session.id, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      resumeActiveFocusSession(session.id, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      updateActiveFocusSession(session, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      discardActiveFocusSession(session.id, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      finalizeActiveFocusSession(
        session.id,
        {
          subjectId: '',
          durationMinutes: 25,
          startedAt: session.startedAt,
          endedAt: new Date().toISOString(),
          notes: '',
        },
        { expectedGeneration: gen },
      ),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    expect(await studyDb.studySessions.count()).toBe(0)
  })
})
