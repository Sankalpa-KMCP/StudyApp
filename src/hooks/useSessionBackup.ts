import { useRef } from 'react'
import { db } from '../db/db'
import { exportStudyBackupFile } from '../lib/backupExport'
import { parseStudyBackupPayload, validateBackupPayload } from '../lib/studyDashboard'
import { devLog } from '../lib/devLogger'
const MAX_SNAPSHOTS = 3

function escapeCsvField(value: string): string {
  const needsFormulaGuard = /^[=+\-@]/.test(value)
  const sanitized = needsFormulaGuard ? `'${value}` : value
  return `"${sanitized.replace(/"/g, '""')}"`
}

export function useSessionBackup(pushToast: (key: string, message: string) => void) {
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      pushToast('BACKUP', 'FAILED TO SAVE LOCAL SNAPSHOT')
    }
  }

  async function exportStudyBackup() {
    try {
      await exportStudyBackupFile('study-vault')
    } catch (err) {
      console.error('Export failed:', err)
      pushToast('BACKUP', 'FAILED TO EXPORT VAULT')
    }
  }

  async function clearSnapshots() {
    try {
      await db.snapshots.clear()
      pushToast('BACKUP', 'LOCAL SNAPSHOTS CLEARED')
    } catch (err) {
      console.error('Failed to clear snapshots:', err)
      pushToast('BACKUP', 'FAILED TO CLEAR SNAPSHOTS')
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
      pushToast('EXPORT', 'CSV EXPORT FAILED')
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
      pushToast('EXPORT', 'TASK CSV EXPORT FAILED')
    }
  }

  async function importStudyBackup(fileString: string) {
    try {
      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(fileString)
      } catch {
        pushToast('BACKUP', 'INVALID BACKUP FILE FORMAT')
        return
      }

      if (!validateBackupPayload(parsedJson)) {
        pushToast('BACKUP', 'VALIDATION FAILED - CORRUPT SCHEMA')
        return
      }

      const data = parseStudyBackupPayload(fileString)
      if (!data) {
        pushToast('BACKUP', 'INVALID BACKUP FILE')
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
      pushToast('BACKUP', 'FAILED TO IMPORT VAULT')
      alert('Failed to import vault: Malformed backup file.')
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
      { key: 'dailyGoalMinutes', value: 480 },
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
      { key: 'auto_pause_on_hidden', value: false },
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
      pushToast('RESET', 'SELECTED TABLES SWEPT')
    } catch (err) {
      console.error('Selective reset failed:', err)
      pushToast('RESET', 'SELECTIVE RESET FAILED')
    }
  }

  return {
    fileInputRef,
    createDatabaseSnapshot,
    exportStudyBackup,
    clearSnapshots,
    exportStudyLogsCSV,
    exportTaskCompletionLogsCSV,
    importStudyBackup,
    resetData,
    resetDataSelective,
  }
}

export type SessionBackupApi = ReturnType<typeof useSessionBackup>
