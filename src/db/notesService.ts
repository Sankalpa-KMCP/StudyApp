import { createId, nowIso, studyDb } from './studyDb'
import type { StudyNote } from './types'

/** Fields the Notes editor supplies after UI validation and tag parsing. */
export type NoteWriteFields = {
  title: string
  body: string
  subjectId: string
  tags: string[]
}

/**
 * Persist a new note. Owns id and created/updated timestamps.
 */
export async function createNote(fields: NoteWriteFields): Promise<StudyNote> {
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
}

/**
 * Update an existing note's editable fields and refresh `updatedAt`.
 * Throws when no row matches `id` (Dexie `update` returns 0).
 */
export async function updateNote(id: string, fields: NoteWriteFields): Promise<void> {
  const updated = await studyDb.notes.update(id, {
    title: fields.title,
    body: fields.body,
    subjectId: fields.subjectId,
    tags: fields.tags,
    updatedAt: nowIso(),
  })
  if (updated === 0) throw new Error('Note no longer exists.')
}

/**
 * Delete a note by id. Missing rows are not treated as errors (Dexie delete is idempotent).
 */
export async function deleteNote(id: string): Promise<void> {
  await studyDb.notes.delete(id)
}
