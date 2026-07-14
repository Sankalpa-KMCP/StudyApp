import { collectStudyBackupPayload } from '../backup/backupExport'
import { getSetting, updateSetting } from '../../db/repositories/settings'
import type { SyncAdapter } from './syncAdapter'
import {
  syncPushFailed,
  syncPushingChanges,
  syncSyncedToFolder,
  syncUpToDate,
} from './syncTerms'
import {
  getLastKnownRemoteChecksum,
  hasActiveSyncConflict,
  isSyncInProgress,
  setLastKnownRemoteChecksum,
  setSyncInProgress,
  setSyncStatus,
} from './syncState'

export interface PushToSyncFolderOptions {
  force?: boolean
}

async function readRemoteChecksum(adapter: SyncAdapter): Promise<string | null> {
  const raw = await adapter.readSyncFile()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { checksumSha256?: string }
    return typeof parsed.checksumSha256 === 'string' ? parsed.checksumSha256 : null
  } catch {
    return null
  }
}

export async function pushToSyncFolder(
  adapter: SyncAdapter,
  options?: PushToSyncFolderOptions,
): Promise<boolean> {
  if (isSyncInProgress()) return false
  if (!options?.force && hasActiveSyncConflict()) return false
  if (!(await adapter.isConnected())) return false

  try {
    setSyncStatus({ connection: 'syncing', message: syncPushingChanges() })
    const payload = await collectStudyBackupPayload()
    const checksum = payload.checksumSha256 ?? ''
    if (!checksum) return false

    const storedChecksum = await getSetting('lastSyncChecksum')
    const stored = typeof storedChecksum === 'string' ? storedChecksum : ''

    if (!options?.force) {
      if (checksum === stored && checksum === getLastKnownRemoteChecksum()) {
        setSyncStatus({ connection: 'connected', message: syncUpToDate() })
        return false
      }

      const remoteChecksum = await readRemoteChecksum(adapter)
      if (remoteChecksum && remoteChecksum === checksum) {
        setLastKnownRemoteChecksum(checksum)
        await updateSetting('lastSyncChecksum', checksum)
        await updateSetting('lastSyncAt', payload.exportedAt)
        setSyncStatus({ connection: 'connected', lastSyncAt: payload.exportedAt, message: syncUpToDate() })
        return false
      }
    }

    setSyncInProgress(true)
    await adapter.writeSyncFile(JSON.stringify(payload, null, 2))
    setLastKnownRemoteChecksum(checksum)
    await updateSetting('lastSyncChecksum', checksum)
    await updateSetting('lastSyncAt', payload.exportedAt)
    setSyncStatus({ connection: 'connected', lastSyncAt: payload.exportedAt, message: syncSyncedToFolder() })
    return true
  } catch (err) {
    console.error('Sync push failed:', err)
    setSyncStatus({ connection: 'error', message: syncPushFailed() })
    return false
  } finally {
    setSyncInProgress(false)
  }
}
