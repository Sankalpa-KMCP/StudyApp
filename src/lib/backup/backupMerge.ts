import type { ParsedStudyBackupPayload } from '../study/studyDashboard'
import { mergeBackupData } from '../../db/repositories/database'

export async function mergeStudyBackup(data: ParsedStudyBackupPayload): Promise<void> {
  await mergeBackupData({
    tasks: data.tasks,
    history: data.history,
    dailyLogs: data.dailyLogs,
    settings: data.settings,
    categories: data.categories,
    flashcards: data.flashcards,
    quickNotes: data.quickNotes,
  })
}
