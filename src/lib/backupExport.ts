import { db } from '../db/db'
import type { CategoryItem, DailyLog, FlashcardItem, HistoryEntry, QuickNoteItem, SettingsRow, TaskItem } from '../db/types'
import type { StudyBackupPayload } from './studyDashboard'
import { computeBackupChecksum } from './backupChecksum'

export type BackupFilenamePrefix = 'study-vault' | 'study-emergency-export'

export type ExportProgressCallback = (progress: number) => void

export async function collectStudyBackupPayload(onProgress?: ExportProgressCallback): Promise<StudyBackupPayload> {
  let step = 0
  const totalSteps = 7
  const tick = () => {
    step += 1
    onProgress?.(Math.round((step / totalSteps) * 100))
  }

  const tasks = await db.tasks.toArray()
  tick()
  const history = await db.history.toArray()
  tick()
  const dailyLogs = await db.daily_logs.toArray()
  tick()
  const settings = await db.settings.toArray()
  tick()
  const categories = await db.categories.toArray()
  tick()
  const flashcards = await db.flashcards.toArray()
  tick()
  const quickNotes = await db.quick_notes.toArray()
  tick()

  const base: Omit<StudyBackupPayload, 'checksumSha256'> = {
    version: 3,
    exportedAt: new Date().toISOString(),
    tasks: tasks as TaskItem[],
    history: history as HistoryEntry[],
    dailyLogs: dailyLogs as DailyLog[],
    settings: settings as SettingsRow[],
    categories: categories as CategoryItem[],
    flashcards: flashcards as FlashcardItem[],
    quickNotes: quickNotes as QuickNoteItem[],
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
