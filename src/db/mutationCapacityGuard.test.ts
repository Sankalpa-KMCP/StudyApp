import { afterEach, describe, expect, it } from 'vitest'
import {
  DatabaseBackupabilityLimitError,
  runBackupableMutation,
} from './backupabilityGuard'
import {
  MAX_STUDY_EXPORT_IMPORT_BYTES,
  STUDY_EXPORT_RECORD_LIMITS,
} from './studyExportLimits'
import { createNote, updateNote, deleteNote } from './notesService'
import { createGoal } from './goalService'
import { saveQuickNotes } from './quickNotesService'
import {
  finalizeActiveFocusSession,
  getActiveFocusSession,
  ACTIVE_FOCUS_SESSION_KEY,
} from './activeFocusSession'
import { getStudyData, studyDb } from './studyDb'
import type { ActiveFocusSession, StudyNote, StudySubject, StudyTask } from './types'

describe('Mutation Capacity Guard Integration (S38.4)', () => {
  afterEach(async () => {
    await studyDb.notes.clear()
    await studyDb.tasks.clear()
    await studyDb.subjects.clear()
    await studyDb.goals.clear()
    await studyDb.studySessions.clear()
    await studyDb.settings.clear()
  })
  describe('Atomic capacity rejection and complete rollback across services', () => {
    it('rejects Note creation exceeding byte limit and leaves IndexedDB unchanged', async () => {
      const notesBefore = await studyDb.notes.toArray()
      const oversizedBody = 'X'.repeat(65 * 1024 * 1024)

      await expect(
        createNote(
          { title: 'Huge Note', body: oversizedBody, subjectId: '', tags: [] },
          { expectedGeneration: 1 }
        )
      ).rejects.toThrow(DatabaseBackupabilityLimitError)

      const notesAfter = await studyDb.notes.toArray()
      expect(notesAfter).toEqual(notesBefore)
    })

    it('rejects Note update that pushes database over byte limit and preserves previous body', async () => {
      const note = await createNote(
        { title: 'Normal Note', body: 'Small content', subjectId: '', tags: [] },
        { expectedGeneration: 1 }
      )

      const oversizedBody = 'Y'.repeat(65 * 1024 * 1024)

      await expect(
        updateNote(
          note.id,
          { title: 'Normal Note', body: oversizedBody, subjectId: '', tags: [] },
          { expectedGeneration: 1 }
        )
      ).rejects.toThrow(DatabaseBackupabilityLimitError)

      const inDb = await studyDb.notes.get(note.id)
      expect(inDb?.body).toBe('Small content')

      await deleteNote(note.id, { expectedGeneration: 1 })
    })

    it('rejects Task creation when task count limit is reached and preserves database', async () => {
      const customLimits = {
        maxBytes: MAX_STUDY_EXPORT_IMPORT_BYTES,
        recordLimits: {
          ...STUDY_EXPORT_RECORD_LIMITS,
          tasks: 2,
        },
      }

      const t1: StudyTask = { id: 't1', title: 'Task 1', subjectId: '', dueDate: '2026-09-01', priority: 'normal', status: 'open', minutes: 15, createdAt: '2026-08-30T00:00:00.000Z', updatedAt: '2026-08-30T00:00:00.000Z' }
      const t2: StudyTask = { id: 't2', title: 'Task 2', subjectId: '', dueDate: '2026-09-01', priority: 'normal', status: 'open', minutes: 15, createdAt: '2026-08-30T00:00:00.000Z', updatedAt: '2026-08-30T00:00:00.000Z' }
      await studyDb.tasks.bulkAdd([t1, t2])

      await expect(
        runBackupableMutation(async () => {
          const t3: StudyTask = { id: 't3', title: 'Task 3', subjectId: '', dueDate: '2026-09-01', priority: 'normal', status: 'open', minutes: 15, createdAt: '2026-08-30T00:00:00.000Z', updatedAt: '2026-08-30T00:00:00.000Z' }
          await studyDb.tasks.add(t3)
        }, customLimits)
      ).rejects.toThrow(DatabaseBackupabilityLimitError)

      expect(await studyDb.tasks.get('t3')).toBeUndefined()
      expect(await studyDb.tasks.count()).toBe(2)

      await studyDb.tasks.clear()
    })

    it('rejects Subject creation when subject ceiling would be exceeded', async () => {
      const customLimits = {
        maxBytes: MAX_STUDY_EXPORT_IMPORT_BYTES,
        recordLimits: {
          ...STUDY_EXPORT_RECORD_LIMITS,
          subjects: 1,
        },
      }

      const s1: StudySubject = { id: 's1', name: 'Math', color: '#111827', targetHours: 10, progress: 0, progressMode: 'manual', createdAt: '2026-08-30T00:00:00.000Z', updatedAt: '2026-08-30T00:00:00.000Z' }
      await studyDb.subjects.add(s1)

      await expect(
        runBackupableMutation(async () => {
          const s2: StudySubject = { id: 's2', name: 'Physics', color: '#111827', targetHours: 10, progress: 0, progressMode: 'manual', createdAt: '2026-08-30T00:00:00.000Z', updatedAt: '2026-08-30T00:00:00.000Z' }
          await studyDb.subjects.add(s2)
        }, customLimits)
      ).rejects.toThrow(DatabaseBackupabilityLimitError)

      expect(await studyDb.subjects.get('s2')).toBeUndefined()
      await studyDb.subjects.clear()
    })

    it('creates Goal normally within capacity', async () => {
      const goal = await createGoal(
        { title: 'Normal Goal', target: 60, progress: 0, period: 'daily', metric: 'study_time' },
        { expectedGeneration: 1 }
      )
      expect(goal).toBeDefined()
      expect(await studyDb.goals.get(goal.id)).toBeDefined()

      await studyDb.goals.clear()
      await studyDb.settings.clear()
    })

    it('rejects QuickNotes when serialized data exceeds limit and preserves existing notes', async () => {
      await studyDb.settings.put({ key: 'quickNotes', value: ['Original Note'] })

      const hugeLine = 'Q'.repeat(65 * 1024 * 1024)
      await expect(
        saveQuickNotes(hugeLine, { expectedGeneration: 1 })
      ).rejects.toThrow(DatabaseBackupabilityLimitError)

      const setting = await studyDb.settings.get('quickNotes')
      expect(setting?.value).toEqual(['Original Note'])
      await studyDb.settings.clear()
    })
  })

  describe('Grandfathered oversized workspace recovery', () => {
    it('permits non-worsening reduction of an already byte-oversized database and rejects growth', async () => {
      const oversizedBody = 'A'.repeat(66 * 1024 * 1024)
      const note: StudyNote = {
        id: 'legacy-big-note',
        title: 'Legacy Big Note',
        body: oversizedBody,
        subjectId: '',
        tags: [],
        createdAt: '2026-08-30T00:00:00.000Z',
        updatedAt: '2026-08-30T00:00:00.000Z',
      }
      await studyDb.notes.add(note)

      const readSnapshot = await getStudyData()
      expect(readSnapshot.notes).toHaveLength(1)

      const longerBody = 'A'.repeat(66 * 1024 * 1024 + 1000)
      await expect(
        updateNote(
          note.id,
          { title: 'Legacy Big Note', body: longerBody, subjectId: '', tags: [] },
          { expectedGeneration: 1 }
        )
      ).rejects.toThrow(DatabaseBackupabilityLimitError)

      const shorterBody = 'A'.repeat(66 * 1024 * 1024 - 10_000)
      await expect(
        updateNote(
          note.id,
          { title: 'Legacy Big Note', body: shorterBody, subjectId: '', tags: [] },
          { expectedGeneration: 1 }
        )
      ).resolves.toBeUndefined()

      const updated = await studyDb.notes.get(note.id)
      expect(updated?.body.length).toBe(shorterBody.length)

      await deleteNote(note.id, { expectedGeneration: 1 })
      expect(await studyDb.notes.get(note.id)).toBeUndefined()
    }, 20_000)
  })

  describe('Focus finalization capacity handling', () => {
    it('returns capacity_limit on finalizeActiveFocusSession when study sessions count is at capacity, preserving active session and writing no history', async () => {
      const subject: StudySubject = {
        id: 'subj-focus',
        name: 'Focus Subj',
        color: '#111827',
        targetHours: 10,
        progress: 0,
        progressMode: 'manual',
        createdAt: '2026-08-30T00:00:00.000Z',
        updatedAt: '2026-08-30T00:00:00.000Z',
      }
      await studyDb.subjects.add(subject)

      const activeSession: ActiveFocusSession = {
        id: 'active-focus-test',
        subjectId: 'subj-focus',
        startedAt: '2026-08-30T10:00:00.000Z',
        plannedMinutes: 25,
        status: 'running',
        pausedAt: null,
        accumulatedPausedMs: 0,
        checkpointElapsedMs: 25 * 60_000,
      }
      await studyDb.settings.put({
        key: ACTIVE_FOCUS_SESSION_KEY,
        value: activeSession,
      })

      // Add a note of 64MB - 200 bytes so that adding a session with 5000 bytes note pushes it over 64 MiB
      const boundaryBody = 'B'.repeat(MAX_STUDY_EXPORT_IMPORT_BYTES - 200)
      await studyDb.notes.add({
        id: 'boundary-note',
        title: 'Boundary Note',
        body: boundaryBody,
        subjectId: '',
        tags: [],
        createdAt: '2026-08-30T00:00:00.000Z',
        updatedAt: '2026-08-30T00:00:00.000Z',
      })

      const result = await finalizeActiveFocusSession(
        activeSession.id,
        {
          subjectId: activeSession.subjectId,
          startedAt: activeSession.startedAt,
          endedAt: '2026-08-30T10:25:00.000Z',
          minutes: 25,
          note: 'F'.repeat(5000),
        },
        { expectedGeneration: 1 }
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe('capacity_limit')
      }

      const historyRow = await studyDb.studySessions.get(activeSession.id)
      expect(historyRow).toBeUndefined()

      const durableActive = await getActiveFocusSession()
      expect(durableActive).not.toBeNull()
      expect(durableActive?.id).toBe(activeSession.id)
      expect(durableActive?.checkpointElapsedMs).toBe(25 * 60_000)

      await studyDb.notes.delete('boundary-note')

      const retryResult = await finalizeActiveFocusSession(
        activeSession.id,
        {
          subjectId: activeSession.subjectId,
          startedAt: activeSession.startedAt,
          endedAt: '2026-08-30T10:25:00.000Z',
          minutes: 25,
          note: 'Focus session note',
        },
        { expectedGeneration: 1 }
      )

      expect(retryResult.ok).toBe(true)
      expect(await studyDb.studySessions.get(activeSession.id)).toBeDefined()
      expect(await getActiveFocusSession()).toBeNull()

      await studyDb.studySessions.clear()
      await studyDb.subjects.clear()
    }, 20_000)
  })
})
