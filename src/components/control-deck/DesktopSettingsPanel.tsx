import { useSettingsPanel } from '../../context/settingsPanelContext'
import { useTranslation } from '../../i18n/useTranslation'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { ToggleSetting } from '../shared/settings/ToggleSetting'
import { Button } from '../shared/Button'
import { scrollToSettingsSection } from '../../lib/settings/settingsSections'
import { isTauri, enableDesktopAutostart, requestDesktopNotificationPermission, setDesktopGlobalShortcuts } from '../../lib/desktop/tauri'

export function DesktopSettingsPanel() {
  const { t } = useTranslation()
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
    <SettingsCard id="settings-desktop" title={t('desktopPanelTitle')} defaultCollapsed>
      <div className="space-y-4">
        <ToggleSetting
          label={t('desktopLaunchOnLogin')}
          description={t('desktopLaunchOnLoginDesc')}
          checked={desktopAutostartEnabled}
          onChange={v => {
            void (async () => {
              await enableDesktopAutostart(v)
              updateSetting('desktopAutostartEnabled', v)
            })()
          }}
        />
        <ToggleSetting
          label={t('desktopGlobalTimerShortcut')}
          description={t('desktopGlobalTimerShortcutDesc')}
          checked={desktopGlobalShortcutsEnabled}
          onChange={v => {
            void (async () => {
              await setDesktopGlobalShortcuts(v, desktopGlobalTimerShortcut)
              updateSetting('desktopGlobalShortcutsEnabled', v)
            })()
          }}
        />
        <div>
          <label htmlFor="desktop-shortcut-key" className="settings-label block mb-1">{t('desktopShortcutKey')}</label>
          <input
            id="desktop-shortcut-key"
            type="text"
            value={desktopGlobalTimerShortcut}
            onChange={e => updateSetting('desktopGlobalTimerShortcut', e.target.value)}
            onBlur={() => {
              if (desktopGlobalShortcutsEnabled) {
                void setDesktopGlobalShortcuts(true, desktopGlobalTimerShortcut)
              }
            }}
            className="settings-input !rounded-lg text-micro max-w-[200px] focus-ring"
            placeholder={t('desktopShortcutKeyPlaceholder')}
          />
        </div>
        <ToggleSetting
          label={t('desktopMinimizeToTray')}
          description={t('desktopMinimizeToTrayDesc')}
          checked={desktopMinimizeOnCloseEnabled}
          onChange={v => updateSetting('desktopMinimizeOnCloseEnabled', v)}
        />
        <ToggleSetting
          label={t('desktopNativeNotifications')}
          description={t('desktopNativeNotificationsDesc')}
          checked={desktopNativeNotificationsEnabled}
          onChange={v => {
            void (async () => {
              if (v) {
                const granted = await requestDesktopNotificationPermission()
                if (!granted) {
                  pushToast('DESKTOP', t('desktopNotificationPermissionDenied'))
                  return
                }
              }
              updateSetting('desktopNativeNotificationsEnabled', v)
            })()
          }}
        />
        <div>
          <p className="settings-label mb-1">{t('desktopSyncFolder')}</p>
          <p className="settings-muted mb-2 text-micro">
            {syncFolderPath
              ? t('desktopSyncFolderConnectedDesc')
              : t('desktopSyncFolderDisconnectedDesc')}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!px-0"
            onClick={() => scrollToSettingsSection('settings-backup-vault')}
          >
            {t('desktopFolderSyncSettingsLink')}
          </Button>
          {syncFolderPath && (
            <p className="text-micro settings-muted mt-2 font-mono break-all">{syncFolderPath}</p>
          )}
        </div>
      </div>
    </SettingsCard>
  )
}
