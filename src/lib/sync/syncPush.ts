import { collectStudyBackupPayload } from '../backup/backupExport'
import { getSetting, updateSetting } from '../../db/repositories/settings'
import type { SyncAdapter } from './syncAdapter'
import {
  getLastKnownRemoteChecksum,
  isSyncInProgress,
  setLastKnownRemoteChecksum,
  setSyncInProgress,
  setSyncStatus,
} from './syncState'

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

export async function pushToSyncFolder(adapter: SyncAdapter): Promise<boolean> {
  if (isSyncInProgress()) return false
  if (!(await adapter.isConnected())) return false

  try {
    setSyncStatus({ connection: 'syncing', message: 'Pushing changes…' })
    const payload = await collectStudyBackupPayload()
    const checksum = payload.checksumSha256 ?? ''
    if (!checksum) return false

    const storedChecksum = await getSetting('lastSyncChecksum')
    const stored = typeof storedChecksum === 'string' ? storedChecksum : ''
    if (checksum === stored && checksum === getLastKnownRemoteChecksum()) {
      setSyncStatus({ connection: 'connected', message: 'Up to date' })
      return false
    }

    const remoteChecksum = await readRemoteChecksum(adapter)
    if (remoteChecksum && remoteChecksum === checksum) {
      setLastKnownRemoteChecksum(checksum)
      await updateSetting('lastSyncChecksum', checksum)
      await updateSetting('lastSyncAt', payload.exportedAt)
      setSyncStatus({ connection: 'connected', lastSyncAt: payload.exportedAt, message: 'Up to date' })
      return false
    }

    setSyncInProgress(true)
    await adapter.writeSyncFile(JSON.stringify(payload, null, 2))
    setLastKnownRemoteChecksum(checksum)
    await updateSetting('lastSyncChecksum', checksum)
    await updateSetting('lastSyncAt', payload.exportedAt)
    setSyncStatus({ connection: 'connected', lastSyncAt: payload.exportedAt, message: 'Synced to folder' })
    return true
  } catch (err) {
    console.error('Sync push failed:', err)
    setSyncStatus({ connection: 'error', message: 'Push failed — check folder permissions' })
    return false
  } finally {
    setSyncInProgress(false)
  }
}
