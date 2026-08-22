import { createId, nowIso, studyDb } from './studyDb'
import type { StudySubject, SubjectProgressMode } from './types'

/** Fields the Subjects editor supplies after name/mode validation and clamping. */
export type SubjectWriteFields = {
  name: string
  color: string
  targetHours: number
  progress: number
  progressMode: SubjectProgressMode
}

/** Per-table linked counts used by the subject deletion policy and warning copy. */
export type SubjectLinkedUsage = {
  tasks: number
  notes: number
  events: number
  sessions: number
}

/**
 * Persist a new subject. Owns id and created/updated timestamps.
 */
export async function createSubject(fields: SubjectWriteFields): Promise<StudySubject> {
  const timestamp = nowIso()
  const subject: StudySubject = {
    id: createId('subject'),
    name: fields.name,
    color: fields.color,
    targetHours: fields.targetHours,
    progress: fields.progress,
    progressMode: fields.progressMode,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await studyDb.subjects.add(subject)
  return subject
}

/**
 * Update an existing subject's editable fields and refresh `updatedAt`.
 * Throws when no row matches `id`.
 */
export async function updateSubject(id: string, fields: SubjectWriteFields): Promise<void> {
  const updated = await studyDb.subjects.update(id, {
    name: fields.name,
    color: fields.color,
    targetHours: fields.targetHours,
    progress: fields.progress,
    progressMode: fields.progressMode,
    updatedAt: nowIso(),
  })
  if (updated === 0) throw new Error('Subject no longer exists.')
}

/**
 * Count study records linked to a subject across the tables protected by the delete policy.
 */
export async function getSubjectLinkedUsage(subjectId: string): Promise<SubjectLinkedUsage> {
  const [tasks, notes, events, sessions] = await Promise.all([
    studyDb.tasks.where('subjectId').equals(subjectId).count(),
    studyDb.notes.where('subjectId').equals(subjectId).count(),
    studyDb.events.where('subjectId').equals(subjectId).count(),
    studyDb.studySessions.where('subjectId').equals(subjectId).count(),
  ])
  return { tasks, notes, events, sessions }
}

/**
 * Delete a subject by id. Missing rows are not treated as errors (Dexie delete is idempotent).
 * Callers must enforce the linked-usage policy before invoking this.
 */
export async function deleteSubject(id: string): Promise<void> {
  await studyDb.subjects.delete(id)
}
