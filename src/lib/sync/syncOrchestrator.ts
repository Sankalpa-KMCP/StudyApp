import { isTauri } from '../desktop/tauri'
import { getSetting } from '../../db/repositories/settings'
import { createDesktopSyncAdapter } from './desktopSyncAdapter'
import { createWebSyncAdapter } from './fileSystemAccess'
import type { SyncAdapter } from './syncAdapter'
import { pullFromSyncFolder } from './syncPull'
import { pushToSyncFolder } from './syncPush'
import { SYNC_POLL_INTERVAL_MS, SYNC_PUSH_DEBOUNCE_MS } from './syncConstants'
import { registerSyncDbHooks } from '../../db/repositories/syncHooks'
import {
  getPollTimer,
  getPushTimer,
  resetSyncRuntimeState,
  setLastKnownRemoteChecksum,
  setPollTimer,
  setPushTimer,
  setSyncStatus,
} from './syncState'

let orchestratorActive = false
let activeAdapter: SyncAdapter | null = null
let lastMetadata: { mtimeMs: number; size: number } | null = null

async function resolveAdapter(syncFolderPath: string): Promise<SyncAdapter | null> {
  if (isTauri()) {
    if (!syncFolderPath) return null
    return createDesktopSyncAdapter(syncFolderPath)
  }
  return createWebSyncAdapter()
}

async function refreshConnectionStatus(adapter: SyncAdapter): Promise<boolean> {
  const connected = await adapter.isConnected()
  if (!connected) {
    setSyncStatus({ connection: 'disconnected', message: 'Sync folder not connected' })
    return false
  }
  const lastSyncAt = await getSetting('lastSyncAt')
  setSyncStatus({
    connection: 'connected',
    lastSyncAt: typeof lastSyncAt === 'string' ? lastSyncAt : '',
    message: 'Watching sync folder',
  })
  return true
}

async function runPullIfChanged(): Promise<void> {
  if (!activeAdapter) return
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
  if (!orchestratorActive || !activeAdapter) return
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
    setSyncStatus({ connection: 'disconnected', message: 'Choose a sync folder to enable sync' })
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

  await runPullIfChanged()

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
  const adapter = activeAdapter ?? await resolveAdapter(syncFolderPath)
  if (!adapter) return
  await pullFromSyncFolder(adapter)
  await pushToSyncFolder(adapter)
  lastMetadata = await adapter.getSyncFileMetadata()
}
