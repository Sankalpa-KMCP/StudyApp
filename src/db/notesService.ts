import { runBackupableMutation } from './backupabilityGuard'
import {
  type DatabaseMutationContext,
  withGuardedMutation,
} from './databaseMutationGuard'
import { createId, nowIso, studyDb } from './studyDb'
import { assertSubjectExists } from './subjectValidation'
import type { StudyNote } from './types'
import { assertNoteWriteFields } from './validation/domainValidation'

/** Fields the Notes editor supplies after UI validation and tag parsing. */
export type NoteWriteFields = {
  title: string
  body: string
  subjectId: string
  tags: string[]
}

/**
 * Persist a new note. Owns id and created/updated timestamps.
 * Enforces transactional subject referential integrity, canonical backupability guard, and database generation guard.
 */
export async function createNote(
  fields: NoteWriteFields,
  context: DatabaseMutationContext,
): Promise<StudyNote> {
  return withGuardedMutation(context, () => {
    assertNoteWriteFields(fields)
    return runBackupableMutation(async () => {
      await assertSubjectExists(fields.subjectId)
      const timestamp = nowIso()
      const note: StudyNote = {
        id: createId('note'),
        title: fields.title,
        body: fields.body,
        subjectId: fields.subjectId,
        tags: fields.tags,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await studyDb.notes.add(note)
      return note
    })
  })
}

/**
 * Update an existing note's editable fields and refresh `updatedAt`.
 * Enforces transactional subject referential integrity, canonical backupability guard, and database generation guard.
 * Throws when no row matches `id` (Dexie `update` returns 0).
 */
export async function updateNote(
  id: string,
  fields: NoteWriteFields,
  context: DatabaseMutationContext,
): Promise<void> {
  return withGuardedMutation(context, () => {
    assertNoteWriteFields(fields)
    return runBackupableMutation(async () => {
      await assertSubjectExists(fields.subjectId)
      const updated = await studyDb.notes.update(id, {
        title: fields.title,
        body: fields.body,
        subjectId: fields.subjectId,
        tags: fields.tags,
        updatedAt: nowIso(),
      })
      if (updated === 0) throw new Error('Note no longer exists.')
    })
  })
}

/**
 * Delete a note by id under database generation guard.
 * Missing rows are not treated as errors (Dexie delete is idempotent).
 */
export async function deleteNote(
  id: string,
  context: DatabaseMutationContext,
): Promise<void> {
  return withGuardedMutation(context, async () => {
    await studyDb.notes.delete(id)
  })
}
