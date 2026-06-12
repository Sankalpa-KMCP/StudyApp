export type SyncConnectionStatus = 'disconnected' | 'connected' | 'syncing' | 'error'

export interface SyncStatusSnapshot {
  connection: SyncConnectionStatus
  lastSyncAt: string
  message: string
}

let syncInProgress = false
let lastKnownRemoteChecksum = ''
let pushTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let status: SyncStatusSnapshot = {
  connection: 'disconnected',
  lastSyncAt: '',
  message: '',
}

const listeners = new Set<(snapshot: SyncStatusSnapshot) => void>()

export function isSyncInProgress(): boolean {
  return syncInProgress
}

export function setSyncInProgress(value: boolean): void {
  syncInProgress = value
}

export function getLastKnownRemoteChecksum(): string {
  return lastKnownRemoteChecksum
}

export function setLastKnownRemoteChecksum(checksum: string): void {
  lastKnownRemoteChecksum = checksum
}

export function getPushTimer(): ReturnType<typeof setTimeout> | null {
  return pushTimer
}

export function setPushTimer(timer: ReturnType<typeof setTimeout> | null): void {
  pushTimer = timer
}

export function getPollTimer(): ReturnType<typeof setInterval> | null {
  return pollTimer
}

export function setPollTimer(timer: ReturnType<typeof setInterval> | null): void {
  pollTimer = timer
}

export function getSyncStatus(): SyncStatusSnapshot {
  return status
}

export function setSyncStatus(next: Partial<SyncStatusSnapshot>): void {
  status = { ...status, ...next }
  listeners.forEach(listener => listener(status))
}

export function subscribeSyncStatus(listener: (snapshot: SyncStatusSnapshot) => void): () => void {
  listeners.add(listener)
  listener(status)
  return () => listeners.delete(listener)
}

export function resetSyncRuntimeState(): void {
  syncInProgress = false
  lastKnownRemoteChecksum = ''
  if (pushTimer) clearTimeout(pushTimer)
  if (pollTimer) clearInterval(pollTimer)
  pushTimer = null
  pollTimer = null
  status = {
    connection: 'disconnected',
    lastSyncAt: '',
    message: '',
  }
}
