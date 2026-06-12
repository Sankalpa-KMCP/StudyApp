import { getSetting, updateSetting } from '../../db/repositories/settings'
import { verifyBackupChecksum } from '../backup/backupChecksum'
import { mergeStudyBackup } from '../backup/backupMerge'
import { parseStudyBackupPayload, validateBackupPayload } from '../study/studyDashboard'
import type { SyncAdapter } from './syncAdapter'
import {
  getLastKnownRemoteChecksum,
  isSyncInProgress,
  setLastKnownRemoteChecksum,
  setSyncInProgress,
  setSyncStatus,
} from './syncState'

export async function pullFromSyncFolder(adapter: SyncAdapter): Promise<boolean> {
  if (isSyncInProgress()) return false
  if (!(await adapter.isConnected())) return false

  try {
    const raw = await adapter.readSyncFile()
    if (!raw) return false

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(raw)
    } catch {
      setSyncStatus({ connection: 'error', message: 'Sync file is not valid JSON' })
      return false
    }

    if (!validateBackupPayload(parsedJson)) {
      setSyncStatus({ connection: 'error', message: 'Sync file has invalid schema' })
      return false
    }

    const data = parseStudyBackupPayload(raw)
    if (!data) return false

    const checksum = data.checksumSha256 ?? ''
    const storedChecksum = await getSetting('lastSyncChecksum')
    const stored = typeof storedChecksum === 'string' ? storedChecksum : ''
    if (checksum && (checksum === stored || checksum === getLastKnownRemoteChecksum())) {
      return false
    }

    const checksumValid = await verifyBackupChecksum(data)
    if (!checksumValid) {
      setSyncStatus({ connection: 'error', message: 'Sync file checksum mismatch' })
      return false
    }

    setSyncStatus({ connection: 'syncing', message: 'Pulling changes…' })
    setSyncInProgress(true)
    await mergeStudyBackup(data)
    setLastKnownRemoteChecksum(checksum)
    await updateSetting('lastSyncChecksum', checksum)
    await updateSetting('lastSyncAt', data.exportedAt)
    setSyncStatus({ connection: 'connected', lastSyncAt: data.exportedAt, message: 'Synced from folder' })
    return true
  } catch (err) {
    console.error('Sync pull failed:', err)
    setSyncStatus({ connection: 'error', message: 'Pull failed — check folder permissions' })
    return false
  } finally {
    setSyncInProgress(false)
  }
}
