import { useSettingsPanel } from './SettingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { ToggleSetting } from '../shared/settings/ToggleSetting'
import { scrollToSettingsSection } from '../../lib/settingsSections'
import { isTauri, enableDesktopAutostart, pickDesktopBackupFolder, requestDesktopNotificationPermission, setDesktopGlobalShortcuts } from '../../lib/tauri'

export function DesktopSettingsPanel() {
  const {
    desktopAutostartEnabled,
    desktopGlobalShortcutsEnabled,
    desktopNativeNotificationsEnabled,
    desktopBackupFolderPath,
    updateSetting,
    pushToast,
  } = useSettingsPanel()

  if (!isTauri()) return null

  return (
    <SettingsCard id="settings-desktop" title="Desktop App">
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
          description="Space toggles the timer when another app is focused (experimental)."
          checked={desktopGlobalShortcutsEnabled}
          onChange={v => {
            void (async () => {
              await setDesktopGlobalShortcuts(v)
              updateSetting('desktopGlobalShortcutsEnabled', v)
            })()
          }}
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
