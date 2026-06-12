import { db } from '../db'

export interface TableRowCounts {
  tasks: number
  history: number
  dailyLogs: number
  flashcards: number
  quickNotes: number
  categories: number
  snapshots: number
}

export async function getTableRowCounts(): Promise<TableRowCounts> {
  const [tasks, history, dailyLogs, flashcards, quickNotes, categories, snapshots] = await Promise.all([
    db.tasks.count(),
    db.history.count(),
    db.daily_logs.count(),
    db.flashcards.count(),
    db.quick_notes.count(),
    db.categories.count(),
    db.snapshots.count(),
  ])
  return { tasks, history, dailyLogs, flashcards, quickNotes, categories, snapshots }
}
