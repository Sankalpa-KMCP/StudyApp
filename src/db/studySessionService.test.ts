import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createStudySession,
  deleteStudySession,
  updateStudySession,
} from './studySessionService'
import { SubjectNotFoundError } from './subjectValidation'
import { studyDb } from './studyDb'

describe('studySessionService', () => {
  beforeEach(async () => {
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
    })

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
    })

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
      })
    } catch (err) {
      thrownError = err
    }

    expect(thrownError).toBeInstanceOf(SubjectNotFoundError)
    expect((thrownError as SubjectNotFoundError).code).toBe('subject_not_found')
    expect((thrownError as SubjectNotFoundError).subjectId).toBe('subject-nonexistent')
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
    })

    await updateStudySession(original.id, {
      subjectId: 'subject-chem',
      startedAt: '2026-07-13T13:00:00.000Z',
      endedAt: '2026-07-13T13:55:00.000Z',
      minutes: 55,
      note: 'Edited note',
    })

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
    })

    let thrownError: unknown = null
    try {
      await updateStudySession(original.id, {
        subjectId: 'subject-ghost',
        startedAt: '2026-07-13T13:00:00.000Z',
        endedAt: '2026-07-13T13:55:00.000Z',
        minutes: 55,
        note: 'Attempted edit',
      })
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
    })).rejects.toThrow('Session no longer exists.')
  })

  it('deletes an existing study session', async () => {
    const created = await createStudySession({
      subjectId: '',
      startedAt: '2026-07-13T09:00:00.000Z',
      endedAt: '2026-07-13T09:20:00.000Z',
      minutes: 20,
      note: 'Temporary',
    })

    await deleteStudySession(created.id)
    expect(await studyDb.studySessions.get(created.id)).toBeUndefined()
  })

  it('treats deleting a missing study session as success', async () => {
    await expect(deleteStudySession('session-already-gone')).resolves.toBeUndefined()
    expect(await studyDb.studySessions.count()).toBe(0)
  })
})
