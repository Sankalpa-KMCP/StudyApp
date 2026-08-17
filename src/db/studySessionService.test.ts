import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createStudySession,
  deleteStudySession,
  updateStudySession,
} from './studySessionService'
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

  it('creates a study session with generated id and persisted fields', async () => {
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

  it('updates editable fields without changing the session id', async () => {
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
