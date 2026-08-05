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
