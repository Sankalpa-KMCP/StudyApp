import { useSettingsPanel } from '../../context/settingsPanelContext'
import { useTranslation } from '../../i18n/useTranslation'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { ToggleSetting } from '../shared/settings/ToggleSetting'
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
          <span className="settings-label block mb-1">{t('desktopShortcutKey')}</span>
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
          <button
            type="button"
            className="text-xs font-semibold text-accent-blue hover:text-accent-blue/80"
            onClick={() => scrollToSettingsSection('settings-backup-vault')}
          >
            {t('desktopFolderSyncSettingsLink')}
          </button>
          {syncFolderPath && (
            <p className="text-micro settings-muted mt-2 font-mono break-all">{syncFolderPath}</p>
          )}
        </div>
      </div>
    </SettingsCard>
  )
}
