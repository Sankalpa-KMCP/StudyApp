import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createStudySession,
  deleteStudySession,
  updateStudySession,
} from './studySessionService'
import { SubjectNotFoundError } from './subjectValidation'
import { DATABASE_GENERATION_KEY, StaleDatabaseGenerationError } from './databaseGeneration'
import { installInMemoryLockAdapter } from './crossTabLock'
import { studyDb } from './studyDb'

describe('studySessionService', () => {
  beforeEach(async () => {
    installInMemoryLockAdapter()
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('creates a study session with generated id and persisted fields for existing subject', async () => {
    await studyDb.subjects.add({
      id: 'subject-math',
      name: 'Mathematics',
      color: '#3b82f6',
      targetHours: 10,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    const created = await createStudySession({
      subjectId: 'subject-math',
      startedAt: '2026-07-13T08:00:00.000Z',
      endedAt: '2026-07-13T08:45:00.000Z',
      minutes: 45,
      note: 'Momentum problems',
    }, { expectedGeneration: 1 })

    expect(created.id).toMatch(/^session-/)
    expect(created).toMatchObject({
      subjectId: 'subject-math',
      startedAt: '2026-07-13T08:00:00.000Z',
      endedAt: '2026-07-13T08:45:00.000Z',
      minutes: 45,
      note: 'Momentum problems',
    })
    expect(await studyDb.studySessions.get(created.id)).toEqual(created)
  })

  it('creates a study session with general subjectId: ""', async () => {
    const created = await createStudySession({
      subjectId: '',
      startedAt: '2026-07-13T08:00:00.000Z',
      endedAt: '2026-07-13T08:45:00.000Z',
      minutes: 45,
      note: 'General study',
    }, { expectedGeneration: 1 })

    expect(created.subjectId).toBe('')
    expect(await studyDb.studySessions.get(created.id)).toEqual(created)
  })

  it('rejects createStudySession when subjectId does not exist and leaves studySessions store empty', async () => {
    let thrownError: unknown = null
    try {
      await createStudySession({
        subjectId: 'subject-nonexistent',
        startedAt: '2026-07-13T08:00:00.000Z',
        endedAt: '2026-07-13T08:45:00.000Z',
        minutes: 45,
        note: 'Orphan session',
      }, { expectedGeneration: 1 })
    } catch (err) {
      thrownError = err
    }

    expect(thrownError).toBeInstanceOf(SubjectNotFoundError)
    expect((thrownError as SubjectNotFoundError).code).toBe('subject_not_found')
    expect((thrownError as SubjectNotFoundError).subjectId).toBe('subject-nonexistent')
    expect(await studyDb.studySessions.count()).toBe(0)
  })

  it('rejects createStudySession when generation is stale', async () => {
    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 3 })

    await expect(createStudySession({
      subjectId: '',
      startedAt: '2026-07-13T08:00:00.000Z',
      endedAt: '2026-07-13T08:45:00.000Z',
      minutes: 45,
      note: 'Stale',
    }, { expectedGeneration: 2 })).rejects.toThrow(StaleDatabaseGenerationError)

    expect(await studyDb.studySessions.count()).toBe(0)
  })

  it('updates editable fields without changing the session id', async () => {
    await studyDb.subjects.add({
      id: 'subject-chem',
      name: 'Chemistry',
      color: '#10b981',
      targetHours: 8,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    const original = await createStudySession({
      subjectId: '',
      startedAt: '2026-07-13T12:00:00.000Z',
      endedAt: '2026-07-13T12:30:00.000Z',
      minutes: 30,
      note: 'Original note',
    }, { expectedGeneration: 1 })

    await updateStudySession(original.id, {
      subjectId: 'subject-chem',
      startedAt: '2026-07-13T13:00:00.000Z',
      endedAt: '2026-07-13T13:55:00.000Z',
      minutes: 55,
      note: 'Edited note',
    }, { expectedGeneration: 1 })

    expect(await studyDb.studySessions.get(original.id)).toEqual({
      id: original.id,
      subjectId: 'subject-chem',
      startedAt: '2026-07-13T13:00:00.000Z',
      endedAt: '2026-07-13T13:55:00.000Z',
      minutes: 55,
      note: 'Edited note',
    })
  })

  it('rejects updateStudySession when assigning a nonexistent subjectId and preserves original session', async () => {
    const original = await createStudySession({
      subjectId: '',
      startedAt: '2026-07-13T12:00:00.000Z',
      endedAt: '2026-07-13T12:30:00.000Z',
      minutes: 30,
      note: 'Original note',
    }, { expectedGeneration: 1 })

    let thrownError: unknown = null
    try {
      await updateStudySession(original.id, {
        subjectId: 'subject-ghost',
        startedAt: '2026-07-13T13:00:00.000Z',
        endedAt: '2026-07-13T13:55:00.000Z',
        minutes: 55,
        note: 'Attempted edit',
      }, { expectedGeneration: 1 })
    } catch (err) {
      thrownError = err
    }

    expect(thrownError).toBeInstanceOf(SubjectNotFoundError)
    expect((thrownError as SubjectNotFoundError).subjectId).toBe('subject-ghost')

    const stored = await studyDb.studySessions.get(original.id)
    expect(stored).toEqual(original)
  })

  it('throws when updating a missing study session', async () => {
    await expect(updateStudySession('session-missing', {
      subjectId: '',
      startedAt: '2026-07-13T12:00:00.000Z',
      endedAt: '2026-07-13T12:30:00.000Z',
      minutes: 30,
      note: '',
    }, { expectedGeneration: 1 })).rejects.toThrow('Session no longer exists.')
  })

  it('rejects updateStudySession when generation is stale', async () => {
    const original = await createStudySession({
      subjectId: '',
      startedAt: '2026-07-13T12:00:00.000Z',
      endedAt: '2026-07-13T12:30:00.000Z',
      minutes: 30,
      note: 'Original note',
    }, { expectedGeneration: 1 })

    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 2 })

    await expect(updateStudySession(original.id, {
      subjectId: '',
      startedAt: '2026-07-13T13:00:00.000Z',
      endedAt: '2026-07-13T13:55:00.000Z',
      minutes: 55,
      note: 'Stale',
    }, { expectedGeneration: 1 })).rejects.toThrow(StaleDatabaseGenerationError)
  })

  it('deletes an existing study session', async () => {
    const created = await createStudySession({
      subjectId: '',
      startedAt: '2026-07-13T09:00:00.000Z',
      endedAt: '2026-07-13T09:20:00.000Z',
      minutes: 20,
      note: 'Temporary',
    }, { expectedGeneration: 1 })

    await deleteStudySession(created.id, { expectedGeneration: 1 })
    expect(await studyDb.studySessions.get(created.id)).toBeUndefined()
  })

  it('treats deleting a missing study session as success', async () => {
    await expect(deleteStudySession('session-already-gone', { expectedGeneration: 1 })).resolves.toBeUndefined()
    expect(await studyDb.studySessions.count()).toBe(0)
  })

  it('rejects deleteStudySession when generation is stale', async () => {
    const created = await createStudySession({
      subjectId: '',
      startedAt: '2026-07-13T09:00:00.000Z',
      endedAt: '2026-07-13T09:20:00.000Z',
      minutes: 20,
      note: 'Temporary',
    }, { expectedGeneration: 1 })

    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 2 })

    await expect(deleteStudySession(created.id, { expectedGeneration: 1 })).rejects.toThrow(StaleDatabaseGenerationError)
    expect(await studyDb.studySessions.get(created.id)).toBeDefined()
  })
})
