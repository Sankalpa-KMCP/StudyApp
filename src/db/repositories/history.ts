import { db } from '../db'
import type { HistoryEntry } from '../types'
import { formatHistoryTimestamp } from '../../lib/studyDashboard'

export function getMonthBounds(year: number, month: number) {
  const start = new Date(year, month, 1, 0, 0, 0, 0).getTime()
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime()
  return { start, end }
}

export async function getHistoryForDateRange(startMs: number, endMs: number) {
  return db.history
    .where('createdAt')
    .between(startMs, endMs, true, true)
    .reverse()
    .sortBy('createdAt')
}

export async function getRecentHistory(limit = 100) {
  return db.history.orderBy('id').reverse().limit(limit).toArray()
}

export async function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'createdAt'> & { createdAt?: number }) {
  const now = Date.now()
  await db.history.add({
    ...entry,
    createdAt: entry.createdAt ?? now,
    timestamp: entry.timestamp || formatHistoryTimestamp(new Date(entry.createdAt ?? now)),
  })
}

export async function clearHistory() {
  await db.history.clear()
}

export async function archiveHistoryOlderThan(days: number): Promise<number> {
  if (days <= 0) return 0
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const stale = await db.history.where('createdAt').below(cutoff).toArray()
  const ids = stale.map(entry => entry.id).filter((id): id is number => id !== undefined)
  if (ids.length === 0) return 0
  await db.history.bulkDelete(ids)
  return ids.length
}
