/** User-facing backup, export, import, and session-restore copy. */
import { t } from '../../i18n'

export const BACKUP_EXPORT_COMPLETE = t('backupExportComplete')
export const BACKUP_EXPORT_FAILED = t('backupExportFailed')
export const BACKUP_SNAPSHOT_FAILED = t('backupSnapshotFailed')
export const BACKUP_SNAPSHOTS_CLEARED = t('backupSnapshotsCleared')
export const BACKUP_SNAPSHOTS_CLEAR_FAILED = t('backupSnapshotsClearFailed')

export const BACKUP_IMPORT_INVALID_FORMAT = t('backupImportInvalidFormat')
export const BACKUP_IMPORT_INVALID_SCHEMA = t('backupImportInvalidSchema')
export const BACKUP_IMPORT_INVALID = t('backupImportInvalid')
export const BACKUP_IMPORT_CHECKSUM_FAILED = t('backupImportChecksumFailed')
export const BACKUP_IMPORT_FAILED = t('backupImportFailed')

export const BACKUP_CSV_EXPORT_FAILED = t('backupCsvExportFailed')
export const BACKUP_TASK_CSV_EXPORT_FAILED = t('backupTaskCsvExportFailed')

export const BACKUP_RESET_SWEPT = t('backupResetSwept')
export const BACKUP_RESET_FAILED = t('backupResetFailed')

export function sessionRestoredMessage(minutes: number, mode: 'study' | 'break') {
  const modeLabel = mode === 'study' ? t('studyBlock') : 'break'
  return t('sessionRestored', { minutes, mode: modeLabel })
}

export const DELETE_FLASHCARD_TITLE = t('deleteFlashcardTitle')
export function deleteFlashcardMessage(question: string) {
  const preview = question.length > 80 ? `${question.slice(0, 80)}…` : question
  return `"${preview}" will be removed permanently.`
}
