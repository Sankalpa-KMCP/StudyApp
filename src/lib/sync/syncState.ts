import type { MergePreviewSummary } from '../backup/mergePreview'
import type { ParsedStudyBackupPayload } from '../study/studyDashboard'

export type SyncConnectionStatus = 'disconnected' | 'connected' | 'syncing' | 'error' | 'conflict'

export interface SyncStatusSnapshot {
  connection: SyncConnectionStatus
  lastSyncAt: string
  message: string
}

export interface SyncConflictSnapshot {
  remotePayload: ParsedStudyBackupPayload
  localChecksum: string
  remoteChecksum: string
  preview: MergePreviewSummary
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
let conflict: SyncConflictSnapshot | null = null

const listeners = new Set<(snapshot: SyncStatusSnapshot) => void>()
const conflictListeners = new Set<(snapshot: SyncConflictSnapshot | null) => void>()

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

export function hasActiveSyncConflict(): boolean {
  return conflict !== null
}

export function getSyncConflict(): SyncConflictSnapshot | null {
  return conflict
}

export function setSyncConflict(snapshot: SyncConflictSnapshot): void {
  conflict = snapshot
  conflictListeners.forEach(listener => listener(conflict))
}

export function clearSyncConflict(): void {
  conflict = null
  conflictListeners.forEach(listener => listener(conflict))
}

export function subscribeSyncConflict(listener: (snapshot: SyncConflictSnapshot | null) => void): () => void {
  conflictListeners.add(listener)
  listener(conflict)
  return () => conflictListeners.delete(listener)
}

export function resetSyncRuntimeState(): void {
  syncInProgress = false
  lastKnownRemoteChecksum = ''
  if (pushTimer) clearTimeout(pushTimer)
  if (pollTimer) clearInterval(pollTimer)
  pushTimer = null
  pollTimer = null
  conflict = null
  status = {
    connection: 'disconnected',
    lastSyncAt: '',
    message: '',
  }
}
