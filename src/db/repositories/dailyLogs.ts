import { db } from '../db'
import { buildDateString } from '../../lib/study/studyDashboard'

export async function incrementStudyMinutes() {
  const current = buildDateString()
  const existing = await db.daily_logs.get(current)
  if (existing) {
    await db.daily_logs.update(current, { studyMinutes: existing.studyMinutes + 1 })
  } else {
    await db.daily_logs.add({ dateString: current, studyMinutes: 1, breakMinutes: 0 })
  }
}

export async function incrementBreakMinutes() {
  const current = buildDateString()
  const existing = await db.daily_logs.get(current)
  if (existing) {
    await db.daily_logs.update(current, { breakMinutes: existing.breakMinutes + 1 })
  } else {
    await db.daily_logs.add({ dateString: current, studyMinutes: 0, breakMinutes: 1 })
  }
}

export async function updateDailyReflection(dateString: string, notes: string, mood: string) {
  const existing = await db.daily_logs.get(dateString)
  if (existing) {
    await db.daily_logs.update(dateString, { notes, mood })
  } else {
    await db.daily_logs.add({ dateString, studyMinutes: 0, breakMinutes: 0, notes, mood })
  }
}

export async function getAllDailyLogs() {
  return db.daily_logs.toArray()
}

export async function addRecoveredMinutes(mode: 'study' | 'break', minutes: number) {
  const current = buildDateString()
  const existing = await db.daily_logs.get(current)
  if (mode === 'study') {
    if (existing) {
      await db.daily_logs.update(current, { studyMinutes: existing.studyMinutes + minutes })
    } else {
      await db.daily_logs.add({ dateString: current, studyMinutes: minutes, breakMinutes: 0 })
    }
  } else if (existing) {
    await db.daily_logs.update(current, { breakMinutes: existing.breakMinutes + minutes })
  } else {
    await db.daily_logs.add({ dateString: current, studyMinutes: 0, breakMinutes: minutes })
  }
}
