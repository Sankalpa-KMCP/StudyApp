import { useRef, useState } from 'react'
import { db } from '../db/db'
import { exportStudyBackupFile, collectStudyBackupPayload, downloadStudyBackup } from '../lib/backupExport'
import { setLastBackupExportAt } from '../lib/backupMetadata'
import { canShareStudyBackup, shareStudyBackup } from '../lib/backupShare'
import { buildStudyHistoryIcs, downloadIcs } from '../lib/icsExport'
import { verifyBackupChecksum } from '../lib/backupChecksum'
import { parseStudyBackupPayload, validateBackupPayload } from '../lib/studyDashboard'
import { devLog } from '../lib/devLogger'
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
} from '../lib/backupTerms'

const MAX_SNAPSHOTS = 3

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
      const [tasks, history, dailyLogs, settings, categories, flashcards, quickNotes] = await Promise.all([
        db.tasks.toArray(),
        db.history.toArray(),
        db.daily_logs.toArray(),
        db.settings.toArray(),
        db.categories.toArray(),
        db.flashcards.toArray(),
        db.quick_notes.toArray(),
      ])
      const snapshot = {
        timestamp: new Date().toISOString(),
        tasks,
        history,
        dailyLogs,
        settings,
        categories,
        flashcards,
        quickNotes,
      }
      await db.snapshots.add({
        timestamp: snapshot.timestamp,
        payload: JSON.stringify(snapshot),
      })
      const count = await db.snapshots.count()
      if (count > MAX_SNAPSHOTS) {
        const oldest = await db.snapshots.orderBy('id').limit(count - MAX_SNAPSHOTS).toArray()
        await db.snapshots.bulkDelete(oldest.map(s => s.id!).filter(Boolean))
      }
    } catch (err) {
      console.error('Failed to create database snapshot:', err)
      pushToast('BACKUP', BACKUP_SNAPSHOT_FAILED)
    }
  }

  async function exportStudyBackup() {
    try {
      setIsExporting(true)
      setExportProgress(0)
      await exportStudyBackupFile('study-vault', setExportProgress)
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
      const [history, categories] = await Promise.all([db.history.toArray(), db.categories.toArray()])
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
      await db.snapshots.clear()
      pushToast('BACKUP', BACKUP_SNAPSHOTS_CLEARED)
    } catch (err) {
      console.error('Failed to clear snapshots:', err)
      pushToast('BACKUP', BACKUP_SNAPSHOTS_CLEAR_FAILED)
    }
  }

  async function exportStudyLogsCSV() {
    try {
      const logs = await db.daily_logs.toArray()
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
      const tasks = await db.tasks.toArray()
      const cats = await db.categories.toArray()
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

  async function importStudyBackup(fileString: string) {
    try {
      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(fileString)
      } catch {
        pushToast('BACKUP', BACKUP_IMPORT_INVALID_FORMAT)
        return
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

      await db.transaction('rw', [db.tasks, db.history, db.daily_logs, db.settings, db.categories, db.flashcards, db.quick_notes, db.snapshots], async () => {
        await Promise.all([
          db.tasks.clear(),
          db.history.clear(),
          db.daily_logs.clear(),
          db.settings.clear(),
          db.categories.clear(),
          db.flashcards.clear(),
          db.quick_notes.clear(),
          db.snapshots.clear(),
        ])

        if (data.tasks.length > 0) await db.tasks.bulkAdd(data.tasks)
        if (data.history.length > 0) await db.history.bulkAdd(data.history)
        if (data.dailyLogs.length > 0) await db.daily_logs.bulkAdd(data.dailyLogs)
        if (data.settings.length > 0) await db.settings.bulkAdd(data.settings)
        if (data.categories.length > 0) await db.categories.bulkAdd(data.categories)
        if (data.flashcards.length > 0) await db.flashcards.bulkAdd(data.flashcards)
        if (data.quickNotes.length > 0) await db.quick_notes.bulkAdd(data.quickNotes)
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
    await db.tasks.clear()
    await db.history.clear()
    await db.daily_logs.clear()
    await db.settings.clear()
    await db.categories.clear()
    await db.flashcards.clear()
    await db.quick_notes.clear()
    await db.snapshots.clear()
    localStorage.removeItem('completed_study_sessions_count')
    localStorage.removeItem('study_dashboard_snapshots')
    await db.settings.bulkAdd([
      { key: 'dailyGoalMinutes', value: 120 },
      { key: 'soundEnabled', value: true },
      { key: 'targetSessionsPerCycle', value: 4 },
      { key: 'longBreakDurationMinutes', value: 15 },
      { key: 'shortBreakDurationMinutes', value: 5 },
      { key: 'studyBlockDurationMinutes', value: 25 },
      { key: 'theme', value: 'midnight-slate' },
      { key: 'cardOpacity', value: 0.70 },
      { key: 'backdropBlur', value: 8 },
      { key: 'initialEasinessFactor', value: 2.5 },
      { key: 'autoArchiveAncientTasks', value: false },
      { key: 'tactile_feedback', value: false },
      { key: 'developer_font', value: 'JetBrains Mono' },
      { key: 'enforce_lockout', value: false },
    ])
    await db.categories.bulkAdd([
      { name: 'General', color: '#64748B' },
      { name: 'Development', color: '#3B82F6' },
      { name: 'Mathematics', color: '#8B5CF6' },
    ])
    window.location.reload()
  }

  async function resetDataSelective(options: { tasks: boolean; history: boolean; categories: boolean; cards: boolean; notes: boolean }) {
    try {
      await db.transaction('rw', [db.tasks, db.history, db.daily_logs, db.categories, db.flashcards, db.quick_notes], async () => {
        if (options.tasks) await db.tasks.clear()
        if (options.history) {
          await db.history.clear()
          await db.daily_logs.clear()
          localStorage.removeItem('completed_study_sessions_count')
        }
        if (options.categories) await db.categories.clear()
        if (options.cards) await db.flashcards.clear()
        if (options.notes) await db.quick_notes.clear()
      })
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
    resetData,
    resetDataSelective,
  }
}

export type SessionBackupApi = ReturnType<typeof useSessionBackup>
