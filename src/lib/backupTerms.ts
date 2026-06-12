/** User-facing backup, export, import, and session-restore copy. */

export const BACKUP_EXPORT_COMPLETE = 'Backup exported successfully'
export const BACKUP_EXPORT_FAILED = 'Could not export backup'
export const BACKUP_SNAPSHOT_FAILED = 'Could not save local snapshot'
export const BACKUP_SNAPSHOTS_CLEARED = 'Local snapshots cleared'
export const BACKUP_SNAPSHOTS_CLEAR_FAILED = 'Could not clear snapshots'

export const BACKUP_IMPORT_INVALID_FORMAT = 'Invalid backup file format'
export const BACKUP_IMPORT_INVALID_SCHEMA = 'Backup file failed validation'
export const BACKUP_IMPORT_INVALID = 'Invalid backup file'
export const BACKUP_IMPORT_CHECKSUM_FAILED = 'Backup checksum mismatch — file may be corrupt'
export const BACKUP_IMPORT_FAILED = 'Could not import backup'

export const BACKUP_CSV_EXPORT_FAILED = 'Could not export study logs CSV'
export const BACKUP_TASK_CSV_EXPORT_FAILED = 'Could not export task CSV'

export const BACKUP_RESET_SWEPT = 'Selected data cleared'
export const BACKUP_RESET_FAILED = 'Could not clear selected data'

export function sessionRestoredMessage(minutes: number, mode: 'study' | 'break') {
  const label = mode === 'study' ? 'study block' : 'break'
  return `Restored ${minutes} min interrupted ${label}`
}

export const DELETE_FLASHCARD_TITLE = 'Delete flashcard?'
export function deleteFlashcardMessage(question: string) {
  const preview = question.length > 80 ? `${question.slice(0, 80)}…` : question
  return `"${preview}" will be removed permanently.`
}
