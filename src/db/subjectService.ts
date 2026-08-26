import { ACTIVE_FOCUS_SESSION_KEY, isActiveFocusSession } from './activeFocusSession'
import {
  type DatabaseMutationContext,
  withGuardedMutation,
} from './databaseMutationGuard'
import { createId, nowIso, studyDb } from './studyDb'
import type { StudySubject, SubjectProgressMode } from './types'
import {
  InvalidSubjectColorError,
  isValidSubjectColor,
} from '../validation/subjectColor'

/** Fields the Subjects editor supplies after name/mode validation and clamping. */
export type SubjectWriteFields = {
  name: string
  color: string
  targetHours: number
  progress: number
  progressMode: SubjectProgressMode
}

function assertSubjectWriteFields(fields: SubjectWriteFields): void {
  if (!isValidSubjectColor(fields.color)) {
    throw new InvalidSubjectColorError(fields.color)
  }
}

/** Per-table linked counts used by the subject deletion policy and warning copy. */
export type SubjectLinkedUsage = {
  tasks: number
  notes: number
  events: number
  sessions: number
  activeFocus: number
}

export type DeleteSubjectResult =
  | { ok: true }
  | { ok: false; reason: 'linked'; usage: SubjectLinkedUsage }

/**
 * Persist a new subject under database generation guard. Owns id and created/updated timestamps.
 */
export async function createSubject(
  fields: SubjectWriteFields,
  context: DatabaseMutationContext,
): Promise<StudySubject> {
  return withGuardedMutation(context, async () => {
    assertSubjectWriteFields(fields)
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
  })
}

/**
 * Update an existing subject's editable fields and refresh `updatedAt`.
 * Enforces database generation guard.
 * Throws when no row matches `id`.
 */
export async function updateSubject(
  id: string,
  fields: SubjectWriteFields,
  context: DatabaseMutationContext,
): Promise<void> {
  return withGuardedMutation(context, async () => {
    assertSubjectWriteFields(fields)
    const updated = await studyDb.subjects.update(id, {
      name: fields.name,
      color: fields.color,
      targetHours: fields.targetHours,
      progress: fields.progress,
      progressMode: fields.progressMode,
      updatedAt: nowIso(),
    })
    if (updated === 0) throw new Error('Subject no longer exists.')
  })
}

/**
 * Count study records linked to a subject across the tables protected by the delete policy,
 * including any active unfinished focus session.
 */
export async function getSubjectLinkedUsage(subjectId: string): Promise<SubjectLinkedUsage> {
  const [tasks, notes, events, sessions, focusRecord] = await Promise.all([
    studyDb.tasks.where('subjectId').equals(subjectId).count(),
    studyDb.notes.where('subjectId').equals(subjectId).count(),
    studyDb.events.where('subjectId').equals(subjectId).count(),
    studyDb.studySessions.where('subjectId').equals(subjectId).count(),
    studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY),
  ])
  const activeFocus =
    focusRecord &&
    isActiveFocusSession(focusRecord.value) &&
    focusRecord.value.subjectId === subjectId
      ? 1
      : 0
  return { tasks, notes, events, sessions, activeFocus }
}

/**
 * Authoritatively and atomically deletes a subject by id under database generation guard.
 * Rechecks all dependent entity tables and the active focus session in one Dexie rw transaction.
 * If any reference exists, deletion is blocked and returns `{ ok: false, reason: 'linked', usage }`.
 * If no references exist, deletes the subject (idempotent for missing ids) and returns `{ ok: true }`.
 */
export async function deleteSubject(
  id: string,
  context: DatabaseMutationContext,
): Promise<DeleteSubjectResult> {
  return withGuardedMutation(context, () =>
    studyDb.transaction(
      'rw',
      [
        studyDb.subjects,
        studyDb.tasks,
        studyDb.notes,
        studyDb.events,
        studyDb.studySessions,
        studyDb.settings,
      ],
      async () => {
        const [tasks, notes, events, sessions, focusRecord] = await Promise.all([
          studyDb.tasks.where('subjectId').equals(id).count(),
          studyDb.notes.where('subjectId').equals(id).count(),
          studyDb.events.where('subjectId').equals(id).count(),
          studyDb.studySessions.where('subjectId').equals(id).count(),
          studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY),
        ])
        const activeFocus =
          focusRecord &&
          isActiveFocusSession(focusRecord.value) &&
          focusRecord.value.subjectId === id
            ? 1
            : 0
        const usage: SubjectLinkedUsage = { tasks, notes, events, sessions, activeFocus }
        const linkedTotal = tasks + notes + events + sessions + activeFocus
        if (linkedTotal > 0) {
          return { ok: false, reason: 'linked', usage }
        }
        await studyDb.subjects.delete(id)
        return { ok: true }
      },
    ),
  )
}
