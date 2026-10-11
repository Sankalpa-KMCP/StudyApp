import { parseAndNormalizeStudyExport } from './studyDb'
import { assertStudyExportImportFileSize, assertStudyExportImportTextLength } from './studyExportLimits'

export type StudyBackupReview = {
  version: number
  counts: Record<'subjects' | 'tasks' | 'notes' | 'events' | 'studySessions' | 'goals' | 'settings', number>
  total: number
  hasFocusSession: boolean
}

/** Read-only preflight. Commit still re-reads the File and validates through importStudyData. */
export async function prepareStudyBackup(file: File): Promise<StudyBackupReview> {
  assertStudyExportImportFileSize(file)
  const text = await file.text()
  assertStudyExportImportTextLength(text)
  // Keep parser errors (including invalid JSON) authoritative.
  const normalized = parseAndNormalizeStudyExport(text)
  const version = (JSON.parse(text) as { version: number }).version
  const counts = {
    subjects: normalized.subjects.length, tasks: normalized.tasks.length,
    notes: normalized.notes.length, events: normalized.events.length,
    studySessions: normalized.studySessions.length, goals: normalized.goals.length,
    settings: normalized.settings.length,
  }
  return {
    version, counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    hasFocusSession: normalized.settings.some((setting) => setting.key === 'activeFocusSession'),
  }
}
