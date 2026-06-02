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
  }
}

export const db = new StudyDashboardDB()
