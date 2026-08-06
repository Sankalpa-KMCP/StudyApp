import { ACTIVE_FOCUS_SESSION_KEY, isActiveFocusSession } from './activeFocusSession'
import type { StudyExport } from './types'

/** Stable internal error; Settings maps import failures to a fixed friendly message. */
export const STUDY_EXPORT_IMPORT_VALIDATION_ERROR = 'Import file is not a Study Dashboard export.'

function assertUniqueKeys(keys: string[]): void {
  const seen = new Set<string>()
  for (const key of keys) {
    if (seen.has(key)) {
      throw new Error(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
    }
    seen.add(key)
  }
}

/**
 * Rejects duplicate primary keys within each table (and duplicate settings keys).
 * Cross-table identifier reuse is allowed. Call after legacy normalization, before any IDB write.
 */
export function assertUniqueStudyExportIdentifiers(
  snapshot: Pick<
    StudyExport,
    'subjects' | 'tasks' | 'notes' | 'events' | 'flashcards' | 'studySessions' | 'goals' | 'settings'
  >,
): void {
  assertUniqueKeys(snapshot.subjects.map((row) => row.id))
  assertUniqueKeys(snapshot.tasks.map((row) => row.id))
  assertUniqueKeys(snapshot.notes.map((row) => row.id))
  assertUniqueKeys(snapshot.events.map((row) => row.id))
  assertUniqueKeys(snapshot.flashcards.map((row) => row.id))
  assertUniqueKeys(snapshot.studySessions.map((row) => row.id))
  assertUniqueKeys(snapshot.goals.map((row) => row.id))
  assertUniqueKeys(snapshot.settings.map((row) => row.key))
}

function assertSubjectReference(subjectId: string, subjectIds: ReadonlySet<string>): void {
  if (subjectId === '') return
  if (!subjectIds.has(subjectId)) {
    throw new Error(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
  }
}

/**
 * Rejects non-empty `subjectId` values that are not present in the imported subjects table.
 * Empty string remains valid (General / unassigned). Call after uniqueness checks, before any IDB write.
 *
 * For `activeFocusSession`, only structurally valid values (via `isActiveFocusSession`) are
 * relationship-checked; malformed focus payloads are left for a later settings-value step.
 */
export function assertStudyExportSubjectReferences(
  snapshot: Pick<
    StudyExport,
    'subjects' | 'tasks' | 'notes' | 'events' | 'flashcards' | 'studySessions' | 'settings'
  >,
): void {
  const subjectIds = new Set(snapshot.subjects.map((subject) => subject.id))

  for (const row of snapshot.tasks) {
    assertSubjectReference(row.subjectId, subjectIds)
  }
  for (const row of snapshot.notes) {
    assertSubjectReference(row.subjectId, subjectIds)
  }
  for (const row of snapshot.events) {
    assertSubjectReference(row.subjectId, subjectIds)
  }
  for (const row of snapshot.flashcards) {
    assertSubjectReference(row.subjectId, subjectIds)
  }
  for (const row of snapshot.studySessions) {
    assertSubjectReference(row.subjectId, subjectIds)
  }

  for (const setting of snapshot.settings) {
    if (setting.key !== ACTIVE_FOCUS_SESSION_KEY) continue
    if (!isActiveFocusSession(setting.value)) continue
    assertSubjectReference(setting.value.subjectId, subjectIds)
  }
}
