import Dexie, { type Table } from 'dexie'
import type { TaskItem, HistoryEntry, DailyLog, SettingsRow, CategoryItem, FlashcardItem, QuickNoteItem, SnapshotRow } from './types'
import { parseLegacyHistoryTimestamp } from '../lib/studyDashboard'

type LegacyTaskRecord = TaskItem & {
  title?: string
  estimatedPomodoros?: number
  actualPomodoros?: number
}

class StudyDashboardDB extends Dexie {
  tasks!: Table<TaskItem, number>
  history!: Table<HistoryEntry, number>
  daily_logs!: Table<DailyLog, string>
  settings!: Table<SettingsRow, string>
  categories!: Table<CategoryItem, number>
  flashcards!: Table<FlashcardItem, number>
  quick_notes!: Table<QuickNoteItem, number>
  snapshots!: Table<SnapshotRow, number>

  constructor() {
    super('StudyDashboardDB')
    this.version(2).stores({
      tasks: '++id, text, completed, createdAt, categoryId',
      history: '++id, timestamp, type, durationMinutes, categoryId',
      settings: '&key, value',
      daily_logs: '&dateString, studyMinutes, breakMinutes',
      categories: '++id, name, color',
    })
    this.version(3).stores({
      tasks: '++id, text, completed, createdAt, categoryId',
      history: '++id, timestamp, type, durationMinutes, categoryId',
      settings: '&key, value',
      daily_logs: '&dateString, studyMinutes, breakMinutes',
      categories: '++id, name, color',
    }).upgrade(async tx => {
      await tx.table('tasks').toCollection().modify((task: LegacyTaskRecord) => {
        if (task.categoryId === undefined) {
          task.categoryId = 1
        }
        if (task.estimatedCycles === undefined) {
          task.estimatedCycles = 1
        }
        if (task.actualCycles === undefined) {
          task.actualCycles = 0
        }
        if (task.title !== undefined && task.text === undefined) {
          task.text = task.title
          task.title = undefined
        }
      })
    })
    this.version(4).stores({
      tasks: '++id, text, completed, createdAt, categoryId',
      history: '++id, timestamp, type, durationMinutes, categoryId',
      settings: '&key, value',
      daily_logs: '&dateString, studyMinutes, breakMinutes',
      categories: '++id, name, color',
      flashcards: '++id, question, answer, categoryId, nextReviewDate',
    })
    this.version(5).stores({
      tasks: '++id, text, completed, createdAt, categoryId',
      history: '++id, timestamp, type, durationMinutes, categoryId',
      settings: '&key, value',
      daily_logs: '&dateString, studyMinutes, breakMinutes',
      categories: '++id, name, color',
      flashcards: '++id, question, answer, categoryId, nextReviewDate',
      quick_notes: '++id, title, content, categoryId, updatedAt',
    })
    this.version(6).stores({
      tasks: '++id, text, completed, createdAt, categoryId',
      history: '++id, timestamp, createdAt, type, durationMinutes, categoryId',
      settings: '&key, value',
      daily_logs: '&dateString, studyMinutes, breakMinutes',
      categories: '++id, name, color',
      flashcards: '++id, question, answer, categoryId, nextReviewDate',
      quick_notes: '++id, title, content, categoryId, updatedAt',
      snapshots: '++id, timestamp',
    }).upgrade(async tx => {
      await tx.table('snapshots').add({
        timestamp: new Date().toISOString(),
        payload: JSON.stringify({ reason: 'pre-v6-migration-backup', at: Date.now() }),
      })

      await tx.table('history').toCollection().modify((entry: HistoryEntry & { createdAt?: number }) => {
        if (entry.createdAt === undefined || !Number.isFinite(entry.createdAt)) {
          entry.createdAt = parseLegacyHistoryTimestamp(entry.timestamp)
        }
      })

      const settingsTable = tx.table('settings')
      const studyBlockSetting = await settingsTable.get('studyBlockDurationMinutes')
      if (!studyBlockSetting) {
        await settingsTable.put({ key: 'studyBlockDurationMinutes', value: 25 })
      }
    })
  }
}

export const db = new StudyDashboardDB()

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const err = event.reason
    if (!err || typeof err !== 'object' || !('name' in err)) return
    const name = String((err as Error).name)
    const message = String((err as Error).message ?? '')
    const isDexieError = name === 'QuotaExceededError'
      || name === 'DatabaseClosedError'
      || message.toLowerCase().includes('indexeddb')
      || message.toLowerCase().includes('quota')
    if (!isDexieError) return
    console.error('Dexie Global Error Caught:', err)
    window.dispatchEvent(new CustomEvent('dexie-error', { detail: err }))
  })
}
