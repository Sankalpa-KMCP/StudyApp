import Dexie, { type Table } from 'dexie'
import type { TaskItem, HistoryEntry, DailyLog, SettingsRow, CategoryItem, FlashcardItem, QuickNoteItem } from './types'

class StudyDashboardDB extends Dexie {
  tasks!: Table<TaskItem, number>
  history!: Table<HistoryEntry, number>
  daily_logs!: Table<DailyLog, string>
  settings!: Table<SettingsRow, string>
  categories!: Table<CategoryItem, number>
  flashcards!: Table<FlashcardItem, number>
  quick_notes!: Table<QuickNoteItem, number>

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
      await tx.table('tasks').toCollection().modify(task => {
        if (task.categoryId === undefined) {
          task.categoryId = 1
        }
        if (task.estimatedCycles === undefined) {
          task.estimatedCycles = 1
        }
        if (task.actualCycles === undefined) {
          task.actualCycles = 0
        }
        if ((task as any).title !== undefined && task.text === undefined) {
          task.text = (task as any).title
          try {
            delete (task as any).title
          } catch {}
        }
      })
    })
    this.version(4).stores({
      tasks: '++id, text, completed, createdAt, categoryId',
      history: '++id, timestamp, type, durationMinutes, categoryId',
      settings: '&key, value',
      daily_logs: '&dateString, studyMinutes, breakMinutes',
      categories: '++id, name, color',
      flashcards: '++id, question, answer, categoryId, nextReviewDate'
    })
    this.version(5).stores({
      tasks: '++id, text, completed, createdAt, categoryId',
      history: '++id, timestamp, type, durationMinutes, categoryId',
      settings: '&key, value',
      daily_logs: '&dateString, studyMinutes, breakMinutes',
      categories: '++id, name, color',
      flashcards: '++id, question, answer, categoryId, nextReviewDate',
      quick_notes: '++id, title, content, categoryId, updatedAt'
    })
  }
}

export const db = new StudyDashboardDB()

