import { createId, studyDb } from './studyDb'
import { assertSubjectExists } from './subjectValidation'
import type { StudySession } from './types'

/** Fields Progress supplies after subject and date/time validation. */
export type StudySessionWriteFields = {
  subjectId: string
  startedAt: string
  endedAt: string
  minutes: number
  note: string
}

/**
 * Persist a new manual study session. Owns id generation.
 * Shares the `studySessions` table with focus finalization; does not change record shape.
 * Enforces transactional subject referential integrity.
 */
export async function createStudySession(fields: StudySessionWriteFields): Promise<StudySession> {
  return studyDb.transaction('rw', studyDb.subjects, studyDb.studySessions, async () => {
    await assertSubjectExists(fields.subjectId)
    const session: StudySession = {
      id: createId('session'),
      subjectId: fields.subjectId,
      startedAt: fields.startedAt,
      endedAt: fields.endedAt,
      minutes: fields.minutes,
      note: fields.note,
    }
    await studyDb.studySessions.add(session)
    return session
  })
}

/**
 * Update an existing study session's editable fields.
 * Enforces transactional subject referential integrity.
 * Throws when no row matches `id`.
 */
export async function updateStudySession(id: string, fields: StudySessionWriteFields): Promise<void> {
  return studyDb.transaction('rw', studyDb.subjects, studyDb.studySessions, async () => {
    await assertSubjectExists(fields.subjectId)
    const updated = await studyDb.studySessions.update(id, {
      subjectId: fields.subjectId,
      startedAt: fields.startedAt,
      endedAt: fields.endedAt,
      minutes: fields.minutes,
      note: fields.note,
    })
    if (updated === 0) throw new Error('Session no longer exists.')
  })
}

/**
 * Delete a study session by id. Missing rows are not treated as errors (Dexie delete is idempotent).
 */
export async function deleteStudySession(id: string): Promise<void> {
  await studyDb.studySessions.delete(id)
}
