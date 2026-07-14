import { exportAllTables } from '../../db/repositories/database'
import { getSetting, updateSetting } from '../../db/repositories/settings'
import { verifyBackupChecksum } from '../backup/backupChecksum'
import { collectStudyBackupPayload } from '../backup/backupExport'
import { computeMergePreview } from '../backup/mergePreview'
import { mergeStudyBackup } from '../backup/backupMerge'
import { parseStudyBackupPayload, validateBackupPayload } from '../study/studyDashboard'
import type { SyncAdapter } from './syncAdapter'
import {
  syncChecksumMismatch,
  syncConflictDetected,
  syncInvalidJson,
  syncInvalidSchema,
  syncPullFailed,
  syncPullingChanges,
  syncSyncedFromFolder,
} from './syncTerms'
import {
  getLastKnownRemoteChecksum,
  hasActiveSyncConflict,
  isSyncInProgress,
  setLastKnownRemoteChecksum,
  setSyncConflict,
  setSyncInProgress,
  setSyncStatus,
} from './syncState'

export async function pullFromSyncFolder(adapter: SyncAdapter): Promise<boolean> {
  if (isSyncInProgress() || hasActiveSyncConflict()) return false
  if (!(await adapter.isConnected())) return false

  try {
    const raw = await adapter.readSyncFile()
    if (!raw) return false

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(raw)
    } catch {
      setSyncStatus({ connection: 'error', message: syncInvalidJson() })
      return false
    }

    if (!validateBackupPayload(parsedJson)) {
      setSyncStatus({ connection: 'error', message: syncInvalidSchema() })
      return false
    }

    const data = parseStudyBackupPayload(raw)
    if (!data) return false

    const remoteChecksum = data.checksumSha256 ?? ''
    const storedChecksum = await getSetting('lastSyncChecksum')
    const stored = typeof storedChecksum === 'string' ? storedChecksum : ''
    if (remoteChecksum && (remoteChecksum === stored || remoteChecksum === getLastKnownRemoteChecksum())) {
      return false
    }

    const checksumValid = await verifyBackupChecksum(data)
    if (!checksumValid) {
      setSyncStatus({ connection: 'error', message: syncChecksumMismatch() })
      return false
    }

    const localPayload = await collectStudyBackupPayload()
    const localChecksum = localPayload.checksumSha256 ?? ''

    if (stored && remoteChecksum !== stored && localChecksum !== stored) {
      const localTables = await exportAllTables()
      const preview = computeMergePreview(localTables, data)
      setSyncConflict({
        remotePayload: data,
        localChecksum,
        remoteChecksum,
        preview,
      })
      setSyncStatus({ connection: 'conflict', message: syncConflictDetected() })
      return false
    }

    setSyncStatus({ connection: 'syncing', message: syncPullingChanges() })
    setSyncInProgress(true)
    await mergeStudyBackup(data)
    setLastKnownRemoteChecksum(remoteChecksum)
    await updateSetting('lastSyncChecksum', remoteChecksum)
    await updateSetting('lastSyncAt', data.exportedAt)
    setSyncStatus({ connection: 'connected', lastSyncAt: data.exportedAt, message: syncSyncedFromFolder() })
    return true
  } catch (err) {
    console.error('Sync pull failed:', err)
    setSyncStatus({ connection: 'error', message: syncPullFailed() })
    return false
  } finally {
    setSyncInProgress(false)
  }
}
