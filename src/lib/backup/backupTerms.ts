/** User-facing backup, export, import, and session-restore copy — call at runtime for locale reactivity. */
import { t } from '../../i18n'

export function backupExportComplete() { return t('backupExportComplete') }
export function backupExportFailed() { return t('backupExportFailed') }
export function backupSnapshotFailed() { return t('backupSnapshotFailed') }
export function backupSnapshotsCleared() { return t('backupSnapshotsCleared') }
export function backupSnapshotsClearFailed() { return t('backupSnapshotsClearFailed') }

export function backupImportInvalidFormat() { return t('backupImportInvalidFormat') }
export function backupImportInvalidSchema() { return t('backupImportInvalidSchema') }
export function backupImportInvalid() { return t('backupImportInvalid') }
export function backupImportChecksumFailed() { return t('backupImportChecksumFailed') }
export function backupImportFailed() { return t('backupImportFailed') }

export function backupCsvExportFailed() { return t('backupCsvExportFailed') }
export function backupTaskCsvExportFailed() { return t('backupTaskCsvExportFailed') }
export function backupIcsExportFailed() { return t('backupIcsExportFailed') }

export function backupResetSwept() { return t('backupResetSwept') }
export function backupResetFailed() { return t('backupResetFailed') }

export function backupPassphraseRequired() { return t('backupPassphraseRequired') }
export function backupMergedSuccessfully() { return t('backupMergedSuccessfully') }
export function backupLegacyFlashcardsSkipped() { return t('backupLegacyFlashcardsSkipped') }
export function backupIcsImportCount(count: number) { return t('backupIcsImportCount', { count }) }
export function backupArchiveHistoryResult(deleted: number) {
  return deleted > 0 ? t('backupArchiveHistoryMany', { count: deleted }) : t('backupArchiveHistoryNone')
}

export function sessionRestoredMessage(minutes: number, mode: 'study' | 'break') {
  const modeLabel = mode === 'study' ? t('studyBlock') : t('breakTab')
  return t('sessionRestored', { minutes, mode: modeLabel })
}
