import { exportAllTables } from '../../db/repositories/database'
import { addSnapshot, trimSnapshotsToMax, clearSnapshots as clearSnapshotsFromDb } from '../../db/repositories/snapshots'
import { backupSnapshotFailed, backupSnapshotsClearFailed, backupSnapshotsCleared } from '../../lib/backup/backupTerms'
import type { PushToast } from './types'

const MAX_SNAPSHOTS = 3

export function useBackupSnapshots(pushToast: PushToast) {
  async function createDatabaseSnapshot() {
    try {
      const { tasks, history, dailyLogs, settings, categories, quickNotes } = await exportAllTables()
      const timestamp = new Date().toISOString()
      const snapshot = { timestamp, tasks, history, dailyLogs, settings, categories, quickNotes }
      await addSnapshot({ timestamp, payload: JSON.stringify(snapshot) })
      await trimSnapshotsToMax(MAX_SNAPSHOTS)
    } catch (err) {
      console.error('Failed to create database snapshot:', err)
      pushToast('BACKUP', backupSnapshotFailed())
    }
  }

  async function clearSnapshots() {
    try {
      await clearSnapshotsFromDb()
      pushToast('BACKUP', backupSnapshotsCleared())
    } catch (err) {
      console.error('Failed to clear snapshots:', err)
      pushToast('BACKUP', backupSnapshotsClearFailed())
    }
  }

  return { createDatabaseSnapshot, clearSnapshots }
}
