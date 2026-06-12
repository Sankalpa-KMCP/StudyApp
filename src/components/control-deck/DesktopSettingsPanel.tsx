import { useSettingsPanel } from './SettingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { ToggleSetting } from '../shared/settings/ToggleSetting'
import { scrollToSettingsSection } from '../../lib/settings/settingsSections'
import { isTauri, enableDesktopAutostart, pickDesktopBackupFolder, requestDesktopNotificationPermission, setDesktopGlobalShortcuts } from '../../lib/desktop/tauri'

export function DesktopSettingsPanel() {
  const {
    desktopAutostartEnabled,
    desktopGlobalShortcutsEnabled,
    desktopNativeNotificationsEnabled,
    desktopBackupFolderPath,
    desktopMinimizeOnCloseEnabled,
    desktopGlobalTimerShortcut,
    updateSetting,
    pushToast,
  } = useSettingsPanel()

  if (!isTauri()) return null

  return (
    <SettingsCard id="settings-desktop" title="Desktop App" defaultCollapsed>
      <div className="space-y-4">
        <ToggleSetting
          label="Launch on login"
          description="Start Study Dashboard when you sign in to your computer."
          checked={desktopAutostartEnabled}
          onChange={v => {
            void (async () => {
              await enableDesktopAutostart(v)
              updateSetting('desktopAutostartEnabled', v)
            })()
          }}
        />
        <ToggleSetting
          label="Global timer shortcut"
          description="Toggles the timer when another app is focused (experimental)."
          checked={desktopGlobalShortcutsEnabled}
          onChange={v => {
            void (async () => {
              await setDesktopGlobalShortcuts(v, desktopGlobalTimerShortcut)
              updateSetting('desktopGlobalShortcutsEnabled', v)
            })()
          }}
        />
        <div>
          <span className="settings-label block mb-1">Shortcut key</span>
          <input
            type="text"
            value={desktopGlobalTimerShortcut}
            onChange={e => updateSetting('desktopGlobalTimerShortcut', e.target.value)}
            onBlur={() => {
              if (desktopGlobalShortcutsEnabled) {
                void setDesktopGlobalShortcuts(true, desktopGlobalTimerShortcut)
              }
            }}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white w-full max-w-[200px]"
            placeholder="Space"
          />
        </div>
        <ToggleSetting
          label="Minimize to tray on close"
          description="Closing the window hides it; use tray Quit to exit."
          checked={desktopMinimizeOnCloseEnabled}
          onChange={v => updateSetting('desktopMinimizeOnCloseEnabled', v)}
        />
        <ToggleSetting
          label="Native notifications"
          description="Show block-complete alerts via the OS when the window is minimized."
          checked={desktopNativeNotificationsEnabled}
          onChange={v => {
            void (async () => {
              if (v) {
                const granted = await requestDesktopNotificationPermission()
                if (!granted) {
                  pushToast('DESKTOP', 'Notification permission was not granted')
                  return
                }
              }
              updateSetting('desktopNativeNotificationsEnabled', v)
            })()
          }}
        />
        <div>
          <p className="settings-label mb-1">Auto-export folder</p>
          <p className="settings-muted mb-2 text-micro">
            {desktopBackupFolderPath
              ? 'Scheduled exports write here instead of triggering a browser download.'
              : 'No folder selected — scheduled exports use browser download.'}
          </p>
          <button
            type="button"
            className="mb-2 text-xs font-semibold text-accent-blue hover:text-accent-blue/80"
            onClick={() => scrollToSettingsSection('settings-backup-vault')}
          >
            Scheduled export settings → Backup Vault
          </button>
          <button
            type="button"
            className="text-xs font-semibold text-accent-blue hover:text-accent-blue/80"
            onClick={() => {
              void pickDesktopBackupFolder().then(path => {
                if (path) updateSetting('desktopBackupFolderPath', path)
              })
            }}
          >
            Choose folder
          </button>
          {desktopBackupFolderPath && (
            <button
              type="button"
              className="ml-3 text-xs font-semibold settings-muted hover:text-[var(--color-text-primary)]"
              onClick={() => updateSetting('desktopBackupFolderPath', '')}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </SettingsCard>
  )
}
