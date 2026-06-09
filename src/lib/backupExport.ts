import { db } from '../db/db'
import type { StudyBackupPayload } from './studyDashboard'

export type BackupFilenamePrefix = 'study-vault' | 'study-emergency-export'

export async function collectStudyBackupPayload(): Promise<StudyBackupPayload> {
  const [tasks, history, dailyLogs, settings, categories, flashcards, quickNotes] = await Promise.all([
    db.tasks.toArray(),
    db.history.toArray(),
    db.daily_logs.toArray(),
    db.settings.toArray(),
    db.categories.toArray(),
    db.flashcards.toArray(),
    db.quick_notes.toArray(),
  ])

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    tasks,
    history,
    dailyLogs,
    settings,
    categories,
    flashcards,
    quickNotes,
  }
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

export async function exportStudyBackupFile(filenamePrefix: BackupFilenamePrefix): Promise<StudyBackupPayload> {
  const payload = await collectStudyBackupPayload()
  downloadStudyBackup(payload, filenamePrefix)
  return payload
}
