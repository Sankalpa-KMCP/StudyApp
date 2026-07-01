import { useSettingsPanel } from './SettingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { ToggleSetting } from '../shared/settings/ToggleSetting'
import { scrollToSettingsSection } from '../../lib/settings/settingsSections'
import { isTauri, enableDesktopAutostart, requestDesktopNotificationPermission, setDesktopGlobalShortcuts } from '../../lib/desktop/tauri'

export function DesktopSettingsPanel() {
  const {
    desktopAutostartEnabled,
    desktopGlobalShortcutsEnabled,
    desktopNativeNotificationsEnabled,
    syncFolderPath,
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
            className="rounded-lg border border-card surface-subtle px-3 py-2 text-xs text-primary w-full max-w-[200px]"
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
          <p className="settings-label mb-1">Sync folder</p>
          <p className="settings-muted mb-2 text-micro">
            {syncFolderPath
              ? 'Web and desktop share data through this folder when folder sync is enabled.'
              : 'Choose a sync folder in Backup Vault to share data with the website.'}
          </p>
          <button
            type="button"
            className="text-xs font-semibold text-accent-blue hover:text-accent-blue/80"
            onClick={() => scrollToSettingsSection('settings-backup-vault')}
          >
            Folder sync settings → Backup Vault
          </button>
          {syncFolderPath && (
            <p className="text-micro settings-muted mt-2 font-mono break-all">{syncFolderPath}</p>
          )}
        </div>
      </div>
    </SettingsCard>
  )
}
