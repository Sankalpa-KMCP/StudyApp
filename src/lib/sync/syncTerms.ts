/** Folder sync status and toast copy — call at runtime for locale reactivity. */
import { t } from '../../i18n'

export function syncFolderNotConnected() { return t('syncFolderNotConnected') }
export function syncWatchingFolder() { return t('syncWatchingFolder') }
export function syncChooseFolder() { return t('syncChooseFolder') }
export function syncInvalidJson() { return t('syncInvalidJson') }
export function syncInvalidSchema() { return t('syncInvalidSchema') }
export function syncChecksumMismatch() { return t('syncChecksumMismatch') }
export function syncPullingChanges() { return t('syncPullingChanges') }
export function syncSyncedFromFolder() { return t('syncSyncedFromFolder') }
export function syncPullFailed() { return t('syncPullFailed') }
export function syncPushingChanges() { return t('syncPushingChanges') }
export function syncUpToDate() { return t('syncUpToDate') }
export function syncPushFailed() { return t('syncPushFailed') }
export function syncRequiresChromeEdge() { return t('syncRequiresChromeEdge') }
export function syncConnectedToFolder(name: string) { return t('syncConnectedToFolder', { name }) }
export function syncConnectFailed() { return t('syncConnectFailed') }
export function syncSyncedToFolder() { return t('syncSyncedToFolder') }
export function syncNeverSynced() { return t('syncNeverSynced') }
export function syncConflictDetected() { return t('syncConflictDetected') }
export function syncConflictResolved() { return t('syncConflictResolved') }
export function syncConflictTitle() { return t('syncConflictTitle') }
export function syncConflictDescription() { return t('syncConflictDescription') }
export function syncConflictKeepLocal() { return t('syncConflictKeepLocal') }
export function syncConflictKeepRemote() { return t('syncConflictKeepRemote') }
export function syncConflictMerge() { return t('syncConflictMerge') }
export function syncConflictPreviewTitle() { return t('syncConflictPreviewTitle') }
export function syncConflictPreviewTasksAdded(count: number) { return t('syncConflictPreviewTasksAdded', { count }) }
export function syncConflictPreviewTasksUpdated(count: number) { return t('syncConflictPreviewTasksUpdated', { count }) }
export function syncConflictPreviewHistory(count: number) { return t('syncConflictPreviewHistory', { count }) }
export function syncConflictPreviewSettings(count: number) { return t('syncConflictPreviewSettings', { count }) }
export function syncConflictPreviewDailyLogs(count: number) { return t('syncConflictPreviewDailyLogs', { count }) }
export function syncConflictPreviewCategories(count: number) { return t('syncConflictPreviewCategories', { count }) }
