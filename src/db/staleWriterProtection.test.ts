import { beforeEach, describe, expect, it } from 'vitest'
import {
  ACTIVE_FOCUS_SESSION_KEY,
  createActiveFocusSession,
  discardActiveFocusSession,
  finalizeActiveFocusSession,
  getActiveFocusSession,
  getActiveFocusSessionWithGeneration,
  pauseActiveFocusSession,
  resumeActiveFocusSession,
  updateActiveFocusSession,
} from './activeFocusSession'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from './calendarEventService'
import {
  installInMemoryLockAdapter,
  withSharedDatabaseLock,
} from './crossTabLock'
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
        minutes: 45,
        startedAt: '2026-09-01T09:00:00.000Z',
        endedAt: '2026-09-01T09:45:00.000Z',
        note: 'Good session',
      },
      { expectedGeneration: gen },
    )

    await clearAllStudyData()

    await expect(
      updateStudySession(
        session.id,
        {
          subjectId: '',
          minutes: 45,
          startedAt: '2026-09-01T09:00:00.000Z',
          endedAt: '2026-09-01T09:45:00.000Z',
          note: 'Zombie notes',
        },
        { expectedGeneration: gen },
      ),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      deleteStudySession(session.id, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      createStudySession(
        {
          subjectId: '',
          minutes: 30,
          startedAt: '2026-09-01T10:00:00.000Z',
          endedAt: '2026-09-01T10:30:00.000Z',
          note: '',
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
    const gen = await captureDatabaseGeneration()
    const focusSession = {
      id: 'focus-test-1',
      subjectId: '',
      plannedMinutes: 25,
      status: 'running' as const,
      startedAt: new Date().toISOString(),
      accumulatedPausedMs: 0,
      pausedAt: null,
    }
    const createResult = await createActiveFocusSession(focusSession, { expectedGeneration: gen })
    expect(createResult.ok).toBe(true)
    if (!createResult.ok) return

    const { session } = createResult

    await clearAllStudyData()

    await expect(
      pauseActiveFocusSession(session.id, undefined, { expectedGeneration: gen }),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    await expect(
      resumeActiveFocusSession(session.id, undefined, { expectedGeneration: gen }),
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
          minutes: 25,
          startedAt: session.startedAt,
          endedAt: new Date().toISOString(),
          note: '',
        },
        { expectedGeneration: gen },
      ),
    ).rejects.toThrow(StaleDatabaseGenerationError)

    expect(await studyDb.studySessions.count()).toBe(0)
  })

  describe('S2-01: Stale delete confirmation generation capture', () => {
    it('rejects stale delete confirmation across all domain entities when generation advances while dialog is open', async () => {
      const initialGen = await captureDatabaseGeneration()

      // Seed all 6 entity types
      const subject = await createSubject(
        { name: 'Biology', color: '#10b981', targetHours: 5, progress: 0, progressMode: 'manual' },
        { expectedGeneration: initialGen },
      )
      const task = await createTask(
        { title: 'Read ch1', subjectId: subject.id, status: 'open', priority: 'normal', minutes: 20, dueDate: '' },
        { expectedGeneration: initialGen },
      )
      const note = await createNote(
        { title: 'Bio Notes', body: 'Cell structure', subjectId: subject.id, tags: [] },
        { expectedGeneration: initialGen },
      )
      const event = await createCalendarEvent(
        { title: 'Bio Lecture', startAt: '2026-09-02T10:00:00.000Z', endAt: '2026-09-02T11:00:00.000Z', location: '', subjectId: subject.id },
        { expectedGeneration: initialGen },
      )
      const goal = await createGoal(
        { title: 'Bio Goal', period: 'weekly', target: 5, progress: 0, metric: 'study_time' },
        { expectedGeneration: initialGen },
      )
      const session = await createStudySession(
        { subjectId: subject.id, minutes: 30, startedAt: '2026-09-01T09:00:00.000Z', endedAt: '2026-09-01T09:30:00.000Z', note: 'Ch1 review' },
        { expectedGeneration: initialGen },
      )

      // User initiates delete for each entity -> UI captures current generation
      const capturedDeleteGen = await captureDatabaseGeneration()

      // Concurrent destructive operation occurs in another tab (advances generation)
      await clearAllStudyData()
      expect(await captureDatabaseGeneration()).toBeGreaterThan(capturedDeleteGen)

      // User subsequently confirms delete in open dialog -> must fail closed
      await expect(deleteTask(task.id, { expectedGeneration: capturedDeleteGen })).rejects.toThrow(StaleDatabaseGenerationError)
      await expect(deleteNote(note.id, { expectedGeneration: capturedDeleteGen })).rejects.toThrow(StaleDatabaseGenerationError)
      await expect(deleteSubject(subject.id, { expectedGeneration: capturedDeleteGen })).rejects.toThrow(StaleDatabaseGenerationError)
      await expect(deleteCalendarEvent(event.id, { expectedGeneration: capturedDeleteGen })).rejects.toThrow(StaleDatabaseGenerationError)
      await expect(deleteGoal(goal.id, { expectedGeneration: capturedDeleteGen })).rejects.toThrow(StaleDatabaseGenerationError)
      await expect(deleteStudySession(session.id, { expectedGeneration: capturedDeleteGen })).rejects.toThrow(StaleDatabaseGenerationError)
    })
  })

  describe('S2-02: Stale Active Focus start rejection and fresh recovery', () => {
    it('rejects focus start with stale generation and succeeds when retried with fresh generation', async () => {
      const staleGen = await captureDatabaseGeneration()

      // Generation advances via clear
      await clearAllStudyData()
      const freshGen = await captureDatabaseGeneration()
      expect(freshGen).toBeGreaterThan(staleGen)

      const session = {
        id: 'focus-start-guard-test',
        subjectId: '',
        plannedMinutes: 25,
        status: 'running' as const,
        startedAt: new Date().toISOString(),
        accumulatedPausedMs: 0,
        pausedAt: null,
      }

      // Attempting to start with stale generation rejects
      await expect(
        createActiveFocusSession(session, { expectedGeneration: staleGen }),
      ).rejects.toThrow(StaleDatabaseGenerationError)
      expect(await getActiveFocusSession()).toBeNull()

      // Retrying with fresh generation succeeds
      const result = await createActiveFocusSession(session, { expectedGeneration: freshGen })
      expect(result.ok).toBe(true)
      expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-start-guard-test', status: 'running' })
    })
  })

  describe('S2-03: Malformed Active Focus settings record safety', () => {
    it('getActiveFocusSession and getActiveFocusSessionWithGeneration are strictly read-only and do not mutate IndexedDB', async () => {
      const gen = await captureDatabaseGeneration()

      // Directly insert malformed record into settings
      await studyDb.settings.put({
        key: ACTIVE_FOCUS_SESSION_KEY,
        value: { corrupted: true, missingFields: true },
      })

      // getActiveFocusSession returns null and does NOT delete the settings record
      const session = await getActiveFocusSession()
      expect(session).toBeNull()
      const rawRecordAfterRead1 = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
      expect(rawRecordAfterRead1).toBeDefined()
      expect(rawRecordAfterRead1?.value).toEqual({ corrupted: true, missingFields: true })

      // getActiveFocusSessionWithGeneration also returns null without deleting
      const withGen = await getActiveFocusSessionWithGeneration()
      expect(withGen.session).toBeNull()
      expect(withGen.generation).toBe(gen)
      const rawRecordAfterRead2 = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
      expect(rawRecordAfterRead2).toBeDefined()

      // Guarded writer (createActiveFocusSession) safely cleans up / overwrites malformed record
      const validSession = {
        id: 'focus-overwrite-malformed',
        subjectId: '',
        plannedMinutes: 25,
        status: 'running' as const,
        startedAt: new Date().toISOString(),
        accumulatedPausedMs: 0,
        pausedAt: null,
      }
      const createResult = await createActiveFocusSession(validSession, { expectedGeneration: gen })
      expect(createResult.ok).toBe(true)
      expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-overwrite-malformed' })
    })
  })

  describe('S2-04: Shared writer vs exclusive destructive lock barrier', () => {
    it('holds shared mutation lock so exclusive destructive operation must wait until shared writer releases', async () => {
      let releaseSharedWriter!: () => void
      let markSharedStarted!: () => void
      const sharedStartedPromise = new Promise<void>((resolve) => {
        markSharedStarted = resolve
      })

      const sharedGate = new Promise<void>((resolve) => {
        releaseSharedWriter = resolve
      })

      let exclusiveExecuted = false

      // Start long-running shared writer
      const sharedWriterPromise = withSharedDatabaseLock(async () => {
        markSharedStarted()
        await sharedGate
        return 'shared_done'
      })

      await sharedStartedPromise

      // Concurrently launch exclusive destructive clear
      const exclusivePromise = clearAllStudyData().then(() => {
        exclusiveExecuted = true
      })

      // Give event loop turns to verify exclusive lock is blocked
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(exclusiveExecuted).toBe(false)

      // Release shared writer
      releaseSharedWriter()
      await sharedWriterPromise

      // Now exclusive lock can execute and finish
      await exclusivePromise
      expect(exclusiveExecuted).toBe(true)
    })
  })
})
