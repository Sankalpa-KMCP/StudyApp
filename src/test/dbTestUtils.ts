import { db } from '../db/db'

export async function resetDatabase() {
  await db.delete()
  await db.open()
}

export async function seedCategory(name: string, color: string) {
  return db.categories.add({ name, color })
}

export async function seedTask(text: string, categoryId?: number) {
  return db.tasks.add({
    text,
    completed: false,
    createdAt: Date.now(),
    categoryId,
    estimatedCycles: 1,
    actualCycles: 0,
  })
}

export async function seedDailyLog(dateString: string, studyMinutes: number, breakMinutes = 0) {
  return db.daily_logs.put({ dateString, studyMinutes, breakMinutes })
}
