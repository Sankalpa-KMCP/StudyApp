import type { ParsedStudyBackupPayload } from '../study/studyDashboard'
import { backupPayloadToTables } from '../study/studyDashboard/backupSchema'
import { mergeBackupData } from '../../db/repositories/database'

export async function mergeStudyBackup(data: ParsedStudyBackupPayload): Promise<void> {
  await mergeBackupData(backupPayloadToTables(data))
}
