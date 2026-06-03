import Dexie, { type Table } from 'dexie'
import type { TaskItem, HistoryEntry, DailyLog, SettingsRow, CategoryItem } from './types'

class StudyDashboardDB extends Dexie {
  tasks!: Table<TaskItem, number>
  history!: Table<HistoryEntry, number>
  daily_logs!: Table<DailyLog, string>
  settings!: Table<SettingsRow, string>
  categories!: Table<CategoryItem, number>

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
  }
}

export const db = new StudyDashboardDB()
