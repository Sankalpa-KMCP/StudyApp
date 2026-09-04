/** Maximum backup import file size (64 MiB). Checked via `File.size` before reading. */
export const MAX_STUDY_EXPORT_IMPORT_BYTES = 64 * 1024 * 1024

/**
 * Maximum backup import text length after `file.text()`.
 * Defense in depth before `JSON.parse` when reported size is wrong or misleading.
 */
export const MAX_STUDY_EXPORT_IMPORT_CHARS = 64 * 1024 * 1024

/** Stable internal error; Settings maps failures to a fixed friendly message. */
export const STUDY_EXPORT_IMPORT_SIZE_ERROR = 'Import file exceeds the Study Dashboard size limit.'

/** Maximum combined records across all imported tables (including settings). */
export const MAX_STUDY_EXPORT_TOTAL_RECORDS = 25_000

export const MAX_STUDY_EXPORT_SUBJECTS = 500
export const MAX_STUDY_EXPORT_TASKS = 5_000
export const MAX_STUDY_EXPORT_NOTES = 5_000
export const MAX_STUDY_EXPORT_EVENTS = 5_000
export const MAX_STUDY_EXPORT_STUDY_SESSIONS = 10_000
export const MAX_STUDY_EXPORT_GOALS = 500
export const MAX_STUDY_EXPORT_SETTINGS = 64

export type StudyExportRecordLimits = {
  total: number
  subjects: number
  tasks: number
  notes: number
  events: number
  studySessions: number
  goals: number
  settings: number
}

/** Production import record-count ceilings (single durable owner). */
export const STUDY_EXPORT_RECORD_LIMITS: StudyExportRecordLimits = {
  total: MAX_STUDY_EXPORT_TOTAL_RECORDS,
  subjects: MAX_STUDY_EXPORT_SUBJECTS,
  tasks: MAX_STUDY_EXPORT_TASKS,
  notes: MAX_STUDY_EXPORT_NOTES,
  events: MAX_STUDY_EXPORT_EVENTS,
  studySessions: MAX_STUDY_EXPORT_STUDY_SESSIONS,
  goals: MAX_STUDY_EXPORT_GOALS,
  settings: MAX_STUDY_EXPORT_SETTINGS,
}

export type StudyExportRecordCounts = {
  subjects: number
  tasks: number
  notes: number
  events: number
  studySessions: number
  goals: number
  settings: number
}

export function assertStudyExportImportFileSize(file: Pick<File, 'size'>): void {
  if (file.size > MAX_STUDY_EXPORT_IMPORT_BYTES) {
    throw new Error(STUDY_EXPORT_IMPORT_SIZE_ERROR)
  }
}

export function assertStudyExportImportTextLength(text: string): void {
  if (text.length > MAX_STUDY_EXPORT_IMPORT_CHARS) {
    throw new Error(STUDY_EXPORT_IMPORT_SIZE_ERROR)
  }
}
