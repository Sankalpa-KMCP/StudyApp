import { db } from '../db'
import type { SnapshotRow } from '../types'

export async function addSnapshot(row: Omit<SnapshotRow, 'id'>): Promise<number> {
  return db.snapshots.add(row)
}

export async function trimSnapshotsToMax(max: number): Promise<void> {
  const count = await db.snapshots.count()
  if (count <= max) return
  const oldest = await db.snapshots.orderBy('id').limit(count - max).toArray()
  await db.snapshots.bulkDelete(oldest.map(s => s.id!).filter(Boolean))
}

export async function clearSnapshots(): Promise<void> {
  await db.snapshots.clear()
}

export async function countSnapshots(): Promise<number> {
  return db.snapshots.count()
}
