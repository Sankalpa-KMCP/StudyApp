import { db } from '../db'
import type { HistoryEntry } from '../types'
import { formatHistoryTimestamp } from '../../lib/studyDashboard'

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
