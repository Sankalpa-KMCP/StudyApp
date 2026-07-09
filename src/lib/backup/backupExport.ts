import type { StudyBackupPayload } from '../study/studyDashboard'
import { computeBackupChecksum } from './backupChecksum'
import { exportAllTables } from '../../db/repositories/database'

export type BackupFilenamePrefix = 'study-vault' | 'study-emergency-export'

export type ExportProgressCallback = (progress: number) => void

export async function collectStudyBackupPayload(onProgress?: ExportProgressCallback): Promise<StudyBackupPayload> {
  let step = 0
  const totalSteps = 6
  const tick = () => {
    step += 1
    onProgress?.(Math.round((step / totalSteps) * 100))
  }

  const tables = await exportAllTables()
  for (let i = 0; i < totalSteps; i++) tick()

  const base: Omit<StudyBackupPayload, 'checksumSha256'> = {
    version: 4,
    exportedAt: new Date().toISOString(),
    tasks: tables.tasks,
    history: tables.history,
    dailyLogs: tables.dailyLogs,
    settings: tables.settings.filter(s => (s.key as string) !== 'flashcardsEnabled'),
    categories: tables.categories,
    quickNotes: tables.quickNotes,
  }

  const checksumSha256 = await computeBackupChecksum(base)
  onProgress?.(100)
  return { ...base, checksumSha256 }
}

export function downloadStudyBackup(payload: StudyBackupPayload, filenamePrefix: BackupFilenamePrefix): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.studybackup`
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportStudyBackupFile(
  filenamePrefix: BackupFilenamePrefix,
  onProgress?: ExportProgressCallback,
): Promise<StudyBackupPayload> {
  const payload = await collectStudyBackupPayload(onProgress)
  downloadStudyBackup(payload, filenamePrefix)
  return payload
}
