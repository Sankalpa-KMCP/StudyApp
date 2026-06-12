import type { StudyBackupPayload } from '../study/studyDashboard'
import type { BackupFilenamePrefix } from './backupExport'

function buildBackupFilename(prefix: BackupFilenamePrefix): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.studybackup`
}

export function canShareStudyBackup(): boolean {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false
  const probe = new File([''], 'probe.studybackup', { type: 'application/json' })
  return navigator.canShare({ files: [probe] })
}

export async function shareStudyBackup(payload: StudyBackupPayload, filenamePrefix: BackupFilenamePrefix): Promise<boolean> {
  if (!canShareStudyBackup()) return false
  const filename = buildBackupFilename(filenamePrefix)
  const file = new File([JSON.stringify(payload, null, 2)], filename, { type: 'application/json' })
  await navigator.share({ files: [file], title: 'Study vault backup' })
  return true
}
