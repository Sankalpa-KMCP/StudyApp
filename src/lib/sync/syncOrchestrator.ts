import { isTauri } from '../desktop/tauri'
import { getSetting, updateSetting } from '../../db/repositories/settings'
import { replaceAllTables } from '../../db/repositories/database'
import { mergeStudyBackup } from '../backup/backupMerge'
import { backupPayloadToTables } from '../study/studyDashboard'
import { createDesktopSyncAdapter } from './desktopSyncAdapter'
import { createWebSyncAdapter } from './fileSystemAccess'
import type { SyncAdapter } from './syncAdapter'
import { isE2eSyncMode } from './testSyncAdapter'
import { pullFromSyncFolder } from './syncPull'
import { pushToSyncFolder } from './syncPush'
import { SYNC_POLL_INTERVAL_MS, SYNC_PUSH_DEBOUNCE_MS } from './syncConstants'
import {
  syncChooseFolder,
  syncConflictResolved,
  syncFolderNotConnected,
  syncWatchingFolder,
} from './syncTerms'
import { registerSyncDbHooks } from '../../db/repositories/syncHooks'
import {
  clearSyncConflict,
  getPollTimer,
  getPushTimer,
  getSyncConflict,
  hasActiveSyncConflict,
  resetSyncRuntimeState,
  setLastKnownRemoteChecksum,
  setPollTimer,
  setPushTimer,
  setSyncInProgress,
  setSyncStatus,
} from './syncState'

let orchestratorActive = false
let activeAdapter: SyncAdapter | null = null
let lastMetadata: { mtimeMs: number; size: number } | null = null

async function resolveAdapter(syncFolderPath: string): Promise<SyncAdapter | null> {
  if (isE2eSyncMode()) {
    const adapter = typeof window !== 'undefined' ? window.__studySyncTestAdapter : undefined
    if (adapter) return adapter
  }
  if (isTauri()) {
    if (!syncFolderPath) return null
    return createDesktopSyncAdapter(syncFolderPath)
  }
  return createWebSyncAdapter()
}

async function refreshConnectionStatus(adapter: SyncAdapter): Promise<boolean> {
  const connected = await adapter.isConnected()
  if (!connected) {
    setSyncStatus({ connection: 'disconnected', message: syncFolderNotConnected() })
    return false
  }
  const lastSyncAt = await getSetting('lastSyncAt')
  setSyncStatus({
    connection: hasActiveSyncConflict() ? 'conflict' : 'connected',
    lastSyncAt: typeof lastSyncAt === 'string' ? lastSyncAt : '',
    message: syncWatchingFolder(),
  })
  return true
}

async function runPullIfChanged(): Promise<void> {
  if (!activeAdapter || hasActiveSyncConflict()) return
  const metadata = await activeAdapter.getSyncFileMetadata()
  if (!metadata) {
    await pullFromSyncFolder(activeAdapter)
    return
  }
  if (
    lastMetadata
    && lastMetadata.mtimeMs === metadata.mtimeMs
    && lastMetadata.size === metadata.size
  ) {
    return
  }
  lastMetadata = metadata
  await pullFromSyncFolder(activeAdapter)
}

export function scheduleSyncPush(): void {
  if (!orchestratorActive || !activeAdapter || hasActiveSyncConflict()) return
  const existing = getPushTimer()
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    setPushTimer(null)
    if (activeAdapter) void pushToSyncFolder(activeAdapter)
  }, SYNC_PUSH_DEBOUNCE_MS)
  setPushTimer(timer)
}

export async function startSyncOrchestrator(syncFolderPath: string): Promise<void> {
  stopSyncOrchestrator()
  orchestratorActive = true

  const adapter = await resolveAdapter(syncFolderPath)
  if (!adapter) {
    setSyncStatus({ connection: 'disconnected', message: syncChooseFolder() })
    return
  }

  activeAdapter = adapter
  registerSyncDbHooks(scheduleSyncPush)

  const checksum = await getSetting('lastSyncChecksum')
  if (typeof checksum === 'string' && checksum) {
    setLastKnownRemoteChecksum(checksum)
  }

  const connected = await refreshConnectionStatus(adapter)
  if (!connected) return

  if (!hasActiveSyncConflict()) {
    await runPullIfChanged()
  }

  const pollTimer = setInterval(() => {
    void runPullIfChanged()
  }, SYNC_POLL_INTERVAL_MS)
  setPollTimer(pollTimer)
}

export function stopSyncOrchestrator(): void {
  orchestratorActive = false
  const pushTimer = getPushTimer()
  const pollTimer = getPollTimer()
  if (pushTimer) clearTimeout(pushTimer)
  if (pollTimer) clearInterval(pollTimer)
  activeAdapter = null
  lastMetadata = null
  resetSyncRuntimeState()
}

export async function syncNow(syncFolderPath: string): Promise<void> {
  if (hasActiveSyncConflict()) return
  const adapter = activeAdapter ?? await resolveAdapter(syncFolderPath)
  if (!adapter) return
  await pullFromSyncFolder(adapter)
  await pushToSyncFolder(adapter)
  lastMetadata = await adapter.getSyncFileMetadata()
}

export type SyncConflictResolution = 'keepLocal' | 'keepRemote' | 'merge'

export async function resolveSyncConflict(action: SyncConflictResolution): Promise<void> {
  const conflict = getSyncConflict()
  if (!conflict || !activeAdapter) return

  try {
    setSyncInProgress(true)
    setSyncStatus({ connection: 'syncing' })

    switch (action) {
      case 'keepLocal':
        await pushToSyncFolder(activeAdapter, { force: true })
        break
      case 'keepRemote': {
        await replaceAllTables(backupPayloadToTables(conflict.remotePayload))
        setLastKnownRemoteChecksum(conflict.remoteChecksum)
        await updateSetting('lastSyncChecksum', conflict.remoteChecksum)
        await updateSetting('lastSyncAt', conflict.remotePayload.exportedAt)
        break
      }
      case 'merge':
        await mergeStudyBackup(conflict.remotePayload)
        await pushToSyncFolder(activeAdapter, { force: true })
        break
    }

    clearSyncConflict()
    const lastSyncAt = await getSetting('lastSyncAt')
    setSyncStatus({
      connection: 'connected',
      lastSyncAt: typeof lastSyncAt === 'string' ? lastSyncAt : conflict.remotePayload.exportedAt,
      message: syncConflictResolved(),
    })
    lastMetadata = await activeAdapter.getSyncFileMetadata()
  } finally {
    setSyncInProgress(false)
  }
}
