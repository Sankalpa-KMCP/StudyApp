import type { StudyBackupPayload } from './studyDashboard'

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
  if (!isTauri()) return null
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({ directory: true, multiple: false, title: 'Choose backup folder' })
  if (selected === null || Array.isArray(selected)) return null
  return selected
}

export async function applySavedDesktopSettings(settings: {
  desktopAutostartEnabled: boolean
  desktopGlobalShortcutsEnabled: boolean
}): Promise<void> {
  if (!isTauri()) return
  await enableDesktopAutostart(settings.desktopAutostartEnabled)
  await setDesktopGlobalShortcuts(settings.desktopGlobalShortcutsEnabled)
}

export async function writeBackupToDesktopFolder(
  folderPath: string,
  payload: StudyBackupPayload,
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

export async function setDesktopGlobalShortcuts(enabled: boolean): Promise<void> {
  if (!isTauri()) return
  const { register, unregister } = await import('@tauri-apps/plugin-global-shortcut')
  if (!enabled) {
    if (globalShortcutsRegistered) {
      await unregister('Space')
      globalShortcutsRegistered = false
    }
    return
  }
  if (globalShortcutsRegistered) return
  await register('Space', () => {
    window.dispatchEvent(new CustomEvent('desktop-timer-toggle'))
  })
  globalShortcutsRegistered = true
}
