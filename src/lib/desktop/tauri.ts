import type { StudyBackupPayload } from '../study/studyDashboard'
import { SYNC_FILE_NAME } from '../sync/syncConstants'
import type { SyncFileMetadata } from '../sync/syncAdapter'
import { t } from '../../i18n'

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function enableDesktopAutostart(enabled: boolean): Promise<void> {
  if (!isTauri()) return
  const { enable, disable, isEnabled } = await import('@tauri-apps/plugin-autostart')
  if (enabled) {
    if (!(await isEnabled())) await enable()
  } else if (await isEnabled()) {
    await disable()
  }
}

export async function requestDesktopNotificationPermission(): Promise<boolean> {
  if (!isTauri()) return false
  const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification')
  if (await isPermissionGranted()) return true
  const result = await requestPermission()
  return result === 'granted'
}

export async function sendDesktopNotification(title: string, body: string): Promise<void> {
  if (!isTauri()) return
  const { isPermissionGranted, sendNotification } = await import('@tauri-apps/plugin-notification')
  if (!(await isPermissionGranted())) return
  sendNotification({ title, body })
}

export async function pickDesktopBackupFolder(): Promise<string | null> {
  return pickSyncFolder()
}

export async function pickSyncFolder(): Promise<string | null> {
  if (!isTauri()) return null
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({ directory: true, multiple: false, title: t('tauriChooseSyncFolder') })
  if (selected === null || Array.isArray(selected)) return null
  return selected
}

function joinFolderPath(folderPath: string, filename: string): string {
  return folderPath.endsWith('/') || folderPath.endsWith('\\')
    ? `${folderPath}${filename}`
    : `${folderPath}/${filename}`
}

export async function writeSyncFile(folderPath: string, content: string): Promise<void> {
  if (!isTauri() || !folderPath) return
  const { writeTextFile } = await import('@tauri-apps/plugin-fs')
  await writeTextFile(joinFolderPath(folderPath, SYNC_FILE_NAME), content)
}

export async function readSyncFile(folderPath: string): Promise<string | null> {
  if (!isTauri() || !folderPath) return null
  const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')
  const path = joinFolderPath(folderPath, SYNC_FILE_NAME)
  if (!(await exists(path))) return null
  return readTextFile(path)
}

export async function getSyncFileMetadata(folderPath: string): Promise<SyncFileMetadata | null> {
  if (!isTauri() || !folderPath) return null
  const { stat } = await import('@tauri-apps/plugin-fs')
  const path = joinFolderPath(folderPath, SYNC_FILE_NAME)
  try {
    const info = await stat(path)
    if (!info.isFile) return null
    const mtime = info.mtime
    const mtimeMs = mtime instanceof Date ? mtime.getTime() : typeof mtime === 'number' ? mtime : 0
    return { mtimeMs, size: info.size ?? 0 }
  } catch {
    return null
  }
}

export async function applySavedDesktopSettings(settings: {
  desktopAutostartEnabled: boolean
  desktopGlobalShortcutsEnabled: boolean
}): Promise<void> {
  if (!isTauri()) return
  await enableDesktopAutostart(settings.desktopAutostartEnabled)
  const { getSetting } = await import('../../db/repositories/settings')
  const shortcutValue = await getSetting('desktopGlobalTimerShortcut')
  const shortcut = typeof shortcutValue === 'string' ? shortcutValue : 'Space'
  await setDesktopGlobalShortcuts(settings.desktopGlobalShortcutsEnabled, shortcut)
}

export async function writeBackupToDesktopFolder(
  folderPath: string,
  payload: StudyBackupPayload | Record<string, unknown>,
  filenamePrefix = 'study-vault',
): Promise<void> {
  if (!isTauri() || !folderPath) return
  const { writeTextFile } = await import('@tauri-apps/plugin-fs')
  const filename = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.studybackup`
  const path = folderPath.endsWith('/') || folderPath.endsWith('\\')
    ? `${folderPath}${filename}`
    : `${folderPath}/${filename}`
  await writeTextFile(path, JSON.stringify(payload, null, 2))
}

let globalShortcutsRegistered = false
let trayBridgeUnlisten: (() => void) | null = null

export async function initDesktopTrayBridge(): Promise<void> {
  if (!isTauri() || trayBridgeUnlisten) return
  const { listen } = await import('@tauri-apps/api/event')
  trayBridgeUnlisten = await listen('desktop-timer-toggle', () => {
    window.dispatchEvent(new CustomEvent('desktop-timer-toggle'))
  })
}

export async function setDesktopTrayTooltip(tooltip: string): Promise<void> {
  if (!isTauri()) return
  const { TrayIcon } = await import('@tauri-apps/api/tray')
  const tray = await TrayIcon.getById('study-tray')
  await tray?.setTooltip(tooltip)
}

let registeredShortcut = 'Space'

export async function setDesktopGlobalShortcuts(enabled: boolean, shortcut = 'Space'): Promise<void> {
  if (!isTauri()) return
  const { register, unregister } = await import('@tauri-apps/plugin-global-shortcut')
  if (globalShortcutsRegistered) {
    await unregister(registeredShortcut)
    globalShortcutsRegistered = false
  }
  if (!enabled) return
  registeredShortcut = shortcut.trim() || 'Space'
  await register(registeredShortcut, () => {
    window.dispatchEvent(new CustomEvent('desktop-timer-toggle'))
  })
  globalShortcutsRegistered = true
}

export async function readLatestBackupFromFolder(folderPath: string): Promise<string | null> {
  if (!isTauri() || !folderPath) return null
  const { readDir, readTextFile } = await import('@tauri-apps/plugin-fs')
  const entries = await readDir(folderPath)
  const backups = entries
    .filter(e => e.name?.endsWith('.studybackup'))
    .sort((a, b) => (b.name ?? '').localeCompare(a.name ?? ''))
  const latest = backups[0]
  if (!latest?.name) return null
  const path = folderPath.endsWith('/') || folderPath.endsWith('\\')
    ? `${folderPath}${latest.name}`
    : `${folderPath}/${latest.name}`
  return readTextFile(path)
}
