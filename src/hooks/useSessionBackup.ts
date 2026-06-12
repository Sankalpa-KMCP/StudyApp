import { useRef, useState } from 'react'
import { collectStudyBackupPayload, downloadStudyBackup } from '../lib/backup/backupExport'
import { exportAllTables, mergeBackupData, replaceAllTables, resetDatabase, resetSelective } from '../db/repositories/database'
import { addSnapshot, trimSnapshotsToMax } from '../db/repositories/snapshots'
import { getAllHistory, bulkAddHistory } from '../db/repositories/history'
import { getAllCategories } from '../db/repositories/categories'
import { getAllTasks } from '../db/repositories/tasks'
import { getAllDailyLogs } from '../db/repositories/dailyLogs'
import { getSetting } from '../db/repositories/settings'
import { decryptBackupEnvelope, encryptBackupPayload, isEncryptedBackupEnvelope } from '../lib/backup/backupCrypto'
import { parseStudyHistoryIcs } from '../lib/export/icsImport'
import { isTauri, writeBackupToDesktopFolder } from '../lib/desktop/tauri'
import { setLastBackupExportAt } from '../lib/backup/backupMetadata'
import { canShareStudyBackup, shareStudyBackup } from '../lib/backup/backupShare'
import { buildStudyHistoryIcs, downloadIcs } from '../lib/export/icsExport'
import { verifyBackupChecksum } from '../lib/backup/backupChecksum'
import { parseStudyBackupPayload, validateBackupPayload } from '../lib/study/studyDashboard'
import { devLog } from '../lib/shared/devLogger'
import {
  BACKUP_CSV_EXPORT_FAILED,
  BACKUP_EXPORT_COMPLETE,
  BACKUP_EXPORT_FAILED,
  BACKUP_IMPORT_CHECKSUM_FAILED,
  BACKUP_IMPORT_FAILED,
  BACKUP_IMPORT_INVALID,
  BACKUP_IMPORT_INVALID_FORMAT,
  BACKUP_IMPORT_INVALID_SCHEMA,
  BACKUP_RESET_FAILED,
  BACKUP_RESET_SWEPT,
  BACKUP_SNAPSHOT_FAILED,
  BACKUP_SNAPSHOTS_CLEAR_FAILED,
  BACKUP_SNAPSHOTS_CLEARED,
  BACKUP_TASK_CSV_EXPORT_FAILED,
} from '../lib/backup/backupTerms'

const MAX_SNAPSHOTS = 3

export type StudyBackupExportDestination = 'auto' | 'download' | 'folder'

export interface StudyBackupExportOptions {
  destination?: StudyBackupExportDestination
  encrypt?: boolean
  passphrase?: string
}

export type StudyBackupImportMode = 'replace' | 'merge'

export interface StudyBackupImportOptions {
  mode?: StudyBackupImportMode
  passphrase?: string
}

async function resolveDesktopBackupFolder(): Promise<string> {
  if (!isTauri()) return ''
  const value = await getSetting('desktopBackupFolderPath')
  return typeof value === 'string' ? value : ''
}

function resolveExportDestination(
  requested: StudyBackupExportDestination,
  folderPath: string,
): 'download' | 'folder' {
  if (requested === 'download') return 'download'
  if (requested === 'folder') return folderPath ? 'folder' : 'download'
  return isTauri() && folderPath ? 'folder' : 'download'
}

function escapeCsvField(value: string): string {
  const needsFormulaGuard = /^[=+\-@]/.test(value)
  const sanitized = needsFormulaGuard ? `'${value}` : value
  return `"${sanitized.replace(/"/g, '""')}"`
}

export function useSessionBackup(pushToast: (key: string, message: string) => void) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  async function createDatabaseSnapshot() {
    try {
      const { tasks, history, dailyLogs, settings, categories, flashcards, quickNotes } = await exportAllTables()
      const timestamp = new Date().toISOString()
      const snapshot = { timestamp, tasks, history, dailyLogs, settings, categories, flashcards, quickNotes }
      await addSnapshot({ timestamp, payload: JSON.stringify(snapshot) })
      await trimSnapshotsToMax(MAX_SNAPSHOTS)
    } catch (err) {
      console.error('Failed to create database snapshot:', err)
      pushToast('BACKUP', BACKUP_SNAPSHOT_FAILED)
    }
  }

  async function exportStudyBackup(options?: StudyBackupExportOptions) {
    try {
      setIsExporting(true)
      setExportProgress(0)
      const payload = await collectStudyBackupPayload(setExportProgress)
      const folder = await resolveDesktopBackupFolder()
      const destination = resolveExportDestination(options?.destination ?? 'download', folder)

      let exportBody: unknown = payload
      if (options?.encrypt && options.passphrase) {
        exportBody = await encryptBackupPayload(payload, options.passphrase, payload.checksumSha256 ?? '')
      }

      if (destination === 'download') {
        if (options?.encrypt && options.passphrase) {
          const blob = new Blob([JSON.stringify(exportBody, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `study-vault-${new Date().toISOString().slice(0, 10)}.studybackup`
          a.click()
          URL.revokeObjectURL(url)
        } else {
          downloadStudyBackup(payload, 'study-vault')
        }
      } else if (folder) {
        await writeBackupToDesktopFolder(folder, exportBody as typeof payload)
      }

      setLastBackupExportAt()
      pushToast('BACKUP', BACKUP_EXPORT_COMPLETE)
    } catch (err) {
      console.error('Export failed:', err)
      pushToast('BACKUP', BACKUP_EXPORT_FAILED)
    } finally {
      setIsExporting(false)
      setExportProgress(0)
    }
  }

  async function shareStudyBackupVault() {
    try {
      setIsExporting(true)
      setExportProgress(0)
      const payload = await collectStudyBackupPayload(setExportProgress)
      const shared = await shareStudyBackup(payload, 'study-vault')
      if (!shared) {
        downloadStudyBackup(payload, 'study-vault')
      }
      setLastBackupExportAt()
      pushToast('BACKUP', BACKUP_EXPORT_COMPLETE)
    } catch (err) {
      console.error('Share failed:', err)
      pushToast('BACKUP', BACKUP_EXPORT_FAILED)
    } finally {
      setIsExporting(false)
      setExportProgress(0)
    }
  }

  async function exportStudyHistoryIcs() {
    try {
      const [history, categories] = await Promise.all([getAllHistory(), getAllCategories()])
      const categoryNames = new Map(categories.filter(c => c.id !== undefined).map(c => [c.id!, c.name]))
      const ics = buildStudyHistoryIcs(history, categoryNames)
      downloadIcs(ics)
    } catch (err) {
      console.error('ICS export failed:', err)
      pushToast('EXPORT', 'ICS export failed')
    }
  }

  async function clearSnapshots() {
    try {
      await clearSnapshots()
      pushToast('BACKUP', BACKUP_SNAPSHOTS_CLEARED)
    } catch (err) {
      console.error('Failed to clear snapshots:', err)
      pushToast('BACKUP', BACKUP_SNAPSHOTS_CLEAR_FAILED)
    }
  }

  async function exportStudyLogsCSV() {
    try {
      const logs = await getAllDailyLogs()
      let csv = 'Date,Study Minutes,Break Minutes,Mood,Notes\n'
      logs.forEach(l => {
        const notes = l.notes ? escapeCsvField(l.notes) : ''
        csv += `${l.dateString},${l.studyMinutes},${l.breakMinutes},${l.mood || ''},${notes}\n`
      })
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `study-logs-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('CSV Export failed:', err)
      pushToast('EXPORT', BACKUP_CSV_EXPORT_FAILED)
    }
  }

  async function exportTaskCompletionLogsCSV() {
    try {
      const tasks = await getAllTasks()
      const cats = await getAllCategories()
      const catMap = new Map(cats.map(c => [c.id, c.name]))

      let csv = 'Task ID,Task Text,Status,Priority,Category,Created At,Estimated Cycles,Actual Cycles,Subtasks Progress,Subtasks Detail\n'
      tasks.forEach(t => {
        const text = t.text ? escapeCsvField(t.text) : ''
        const status = t.completed ? 'Completed' : 'Active'
        const priority = t.priority || 'medium'
        const category = t.categoryId ? (catMap.get(t.categoryId) || '') : ''
        const dateStr = new Date(t.createdAt).toISOString().slice(0, 10)
        const subtasksCount = t.subtasks?.length || 0
        const subtasksCompleted = t.subtasks?.filter(s => s.completed).length || 0
        const progress = subtasksCount > 0 ? `${subtasksCompleted}/${subtasksCount}` : 'N/A'
        const detail = t.subtasks ? `"${t.subtasks.map(s => `[${s.completed ? 'x' : ' '}] ${s.text}`).join('; ').replace(/"/g, '""')}"` : ''

        csv += `${t.id || ''},${text},${status},${priority},${category},${dateStr},${t.estimatedCycles},${t.actualCycles},${progress},${detail}\n`
      })

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `task-logs-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Task CSV Export failed:', err)
      pushToast('EXPORT', BACKUP_TASK_CSV_EXPORT_FAILED)
    }
  }

  async function importStudyHistoryIcs(fileString: string) {
    try {
      const entries = parseStudyHistoryIcs(fileString)
      if (entries.length === 0) {
        pushToast('BACKUP', BACKUP_IMPORT_INVALID)
        return
      }
      await bulkAddHistory(entries)
      pushToast('BACKUP', `Imported ${entries.length} study sessions from calendar`)
    } catch (err) {
      console.error('ICS import failed:', err)
      pushToast('BACKUP', BACKUP_IMPORT_FAILED)
    }
  }

  async function importStudyBackup(fileString: string, options?: StudyBackupImportOptions) {
    try {
      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(fileString)
      } catch {
        pushToast('BACKUP', BACKUP_IMPORT_INVALID_FORMAT)
        return
      }

      if (isEncryptedBackupEnvelope(parsedJson)) {
        if (!options?.passphrase) {
          pushToast('BACKUP', 'Passphrase required for encrypted backup')
          return
        }
        const decrypted = await decryptBackupEnvelope(parsedJson, options.passphrase)
        parsedJson = decrypted
        fileString = JSON.stringify(decrypted)
      }

      if (!validateBackupPayload(parsedJson)) {
        pushToast('BACKUP', BACKUP_IMPORT_INVALID_SCHEMA)
        return
      }

      const data = parseStudyBackupPayload(fileString)
      if (!data) {
        pushToast('BACKUP', BACKUP_IMPORT_INVALID)
        return
      }

      const checksumValid = await verifyBackupChecksum(data)
      if (!checksumValid) {
        pushToast('BACKUP', BACKUP_IMPORT_CHECKSUM_FAILED)
        return
      }

      if (options?.mode === 'merge') {
        await mergeBackupData({
          tasks: data.tasks,
          history: data.history,
          dailyLogs: data.dailyLogs,
          settings: data.settings,
          categories: data.categories,
          flashcards: data.flashcards,
          quickNotes: data.quickNotes,
        })
        pushToast('BACKUP', 'Backup merged successfully')
        devLog('backup', 'merge-success', { tasks: data.tasks.length, history: data.history.length })
        return
      }

      await replaceAllTables({
        tasks: data.tasks,
        history: data.history,
        dailyLogs: data.dailyLogs,
        settings: data.settings,
        categories: data.categories,
        flashcards: data.flashcards,
        quickNotes: data.quickNotes,
      })

      localStorage.removeItem('study_dashboard_snapshots')
      localStorage.removeItem('completed_study_sessions_count')
      devLog('backup', 'import-success', { tasks: data.tasks.length, history: data.history.length })
      window.location.reload()
    } catch (err) {
      console.error('Failed to import vault:', err)
      pushToast('BACKUP', BACKUP_IMPORT_FAILED)
    }
  }

  async function resetData() {
    await resetDatabase()
    localStorage.removeItem('completed_study_sessions_count')
    localStorage.removeItem('study_dashboard_snapshots')
    window.location.reload()
  }

  async function resetDataSelective(options: { tasks: boolean; history: boolean; categories: boolean; cards: boolean; notes: boolean }) {
    try {
      await resetSelective(options)
      if (options.history) {
        localStorage.removeItem('completed_study_sessions_count')
      }
      pushToast('RESET', BACKUP_RESET_SWEPT)
    } catch (err) {
      console.error('Selective reset failed:', err)
      pushToast('RESET', BACKUP_RESET_FAILED)
    }
  }

  return {
    fileInputRef,
    isExporting,
    exportProgress,
    createDatabaseSnapshot,
    exportStudyBackup,
    shareStudyBackupVault,
    exportStudyHistoryIcs,
    canShareBackup: canShareStudyBackup(),
    clearSnapshots,
    exportStudyLogsCSV,
    exportTaskCompletionLogsCSV,
    importStudyBackup,
    importStudyHistoryIcs,
    resetData,
    resetDataSelective,
  }
}

export type SessionBackupApi = ReturnType<typeof useSessionBackup>
