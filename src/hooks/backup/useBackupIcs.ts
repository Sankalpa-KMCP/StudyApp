import { getAllHistory, bulkAddHistory, archiveHistoryOlderThan } from '../../db/repositories/history'
import { getAllCategories } from '../../db/repositories/categories'
import { getAllDailyLogs } from '../../db/repositories/dailyLogs'
import { getAllTasks } from '../../db/repositories/tasks'
import { parseStudyHistoryIcs } from '../../lib/export/icsImport'
import { buildStudyHistoryIcs, downloadIcs } from '../../lib/export/icsExport'
import {
  backupCsvExportFailed,
  backupIcsExportFailed,
  backupIcsImportCount,
  backupImportFailed,
  backupImportInvalid,
  backupTaskCsvExportFailed,
} from '../../lib/backup/backupTerms'
import { buildStudyLogsCsv, buildTaskCompletionCsv, downloadCsvBlob } from '../../lib/backup/csvExport'
import type { PushToast } from './types'

export function useBackupIcs(pushToast: PushToast) {
  async function exportStudyHistoryIcs() {
    try {
      const [history, categories] = await Promise.all([getAllHistory(), getAllCategories()])
      const categoryNames = new Map(categories.filter(c => c.id !== undefined).map(c => [c.id!, c.name]))
      const ics = buildStudyHistoryIcs(history, categoryNames)
      downloadIcs(ics)
    } catch (err) {
      console.error('ICS export failed:', err)
      pushToast('EXPORT', backupIcsExportFailed())
    }
  }

  async function exportStudyLogsCSV() {
    try {
      const logs = await getAllDailyLogs()
      const csv = buildStudyLogsCsv(logs)
      downloadCsvBlob(csv, `study-logs-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (err) {
      console.error('CSV Export failed:', err)
      pushToast('EXPORT', backupCsvExportFailed())
    }
  }

  async function exportTaskCompletionLogsCSV() {
    try {
      const [tasks, cats] = await Promise.all([getAllTasks(), getAllCategories()])
      const csv = buildTaskCompletionCsv(tasks, cats)
      downloadCsvBlob(csv, `task-logs-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (err) {
      console.error('Task CSV Export failed:', err)
      pushToast('EXPORT', backupTaskCsvExportFailed())
    }
  }

  async function importStudyHistoryIcs(fileString: string) {
    try {
      const entries = parseStudyHistoryIcs(fileString)
      if (entries.length === 0) {
        pushToast('BACKUP', backupImportInvalid())
        return
      }
      await bulkAddHistory(entries)
      pushToast('BACKUP', backupIcsImportCount(entries.length))
    } catch (err) {
      console.error('ICS import failed:', err)
      pushToast('BACKUP', backupImportFailed())
    }
  }

  return {
    exportStudyHistoryIcs,
    exportStudyLogsCSV,
    exportTaskCompletionLogsCSV,
    importStudyHistoryIcs,
    archiveHistoryOlderThan,
  }
}
