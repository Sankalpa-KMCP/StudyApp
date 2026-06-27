import { useState } from 'react'

import { useSettingsPanel } from '../../context/settingsPanelContext'

import { useTranslation } from '../../i18n/useTranslation'

import { useSyncFolderDisplay } from '../../hooks/useSyncFolderDisplay'

import { SettingsDisclosure } from '../shared/settings/SettingsDisclosure'

import { ToggleSetting } from '../shared/settings/ToggleSetting'

import { Button } from '../shared/Button'

import { isTauri, pickSyncFolder } from '../../lib/desktop/tauri'

import {

  connectSyncFolder,

  disconnectSyncFolder,

  isFileSystemAccessSupported,

  syncNow,

} from '../../lib/sync'

import {
  syncConnectedToFolder,
  syncConnectFailed,
  syncRequiresChromeEdge,
} from '../../lib/sync/syncTerms'

import { SyncConflictModal } from './SyncConflictModal'



function formatLastSync(lastSyncAt: string, neverSyncedLabel: string): string {

  if (!lastSyncAt) return neverSyncedLabel

  const date = new Date(lastSyncAt)

  if (Number.isNaN(date.getTime())) return neverSyncedLabel

  return date.toLocaleString()

}



export function FolderSyncPanel() {

  const { t } = useTranslation()

  const {

    syncEnabled,

    syncFolderPath,

    updateSetting,

    pushToast,

  } = useSettingsPanel()

  const {
    syncStatus,
    setWebFolderLabel,
    folderLabel,
    folderConnected,
  } = useSyncFolderDisplay({
    syncFolderPath,
    syncEnabled,
  })

  const [isConnecting, setIsConnecting] = useState(false)

  const fsAccessSupported = isFileSystemAccessSupported()



  async function handleChooseFolder() {

    setIsConnecting(true)

    try {

      if (isTauri()) {

        const path = await pickSyncFolder()

        if (path) {

          updateSetting('syncFolderPath', path)

          updateSetting('desktopBackupFolderPath', path)

        }

        return

      }



      if (!fsAccessSupported) {

        pushToast('SYNC', syncRequiresChromeEdge())

        return

      }



      const handle = await connectSyncFolder()

      if (handle) {

        setWebFolderLabel(handle.name)

        updateSetting('syncFolderPath', handle.name)

        pushToast('SYNC', syncConnectedToFolder(handle.name))

      }

    } catch (err) {

      console.error('Failed to connect sync folder:', err)

      pushToast('SYNC', syncConnectFailed())

    } finally {

      setIsConnecting(false)

    }

  }



  async function handleDisconnect() {

    if (isTauri()) {

      updateSetting('syncFolderPath', '')

      updateSetting('desktopBackupFolderPath', '')

      return

    }

    await disconnectSyncFolder()

    setWebFolderLabel('')

    updateSetting('syncFolderPath', '')

  }



  return (

    <SettingsDisclosure title={t('folderSyncTitle')} defaultOpen={false}>

      <div className="rounded-2xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] p-4 space-y-4">

        <p className="settings-muted text-[11px] leading-relaxed">

          {t('folderSyncDescription')}

        </p>



        {!isTauri() && !fsAccessSupported && (

          <p className="text-[11px] status-banner-warning-body">

            {t('folderSyncBrowserWarning')}

          </p>

        )}



        <ToggleSetting

          label={t('folderSyncEnable')}

          description={t('folderSyncEnableDesc')}

          checked={syncEnabled}

          onChange={v => updateSetting('syncEnabled', v)}

        />



        <div className="flex flex-wrap gap-2">

          <Button

            variant="secondary"

            size="sm"

            onClick={() => { void handleChooseFolder() }}

            disabled={isConnecting}

          >

            {folderConnected ? t('folderSyncChangeFolder') : t('folderSyncChooseFolder')}

          </Button>

          {folderConnected && (

            <Button variant="secondary" size="sm" onClick={() => { void handleDisconnect() }}>

              {t('folderSyncDisconnect')}

            </Button>

          )}

          {syncEnabled && folderConnected && (

            <Button

              variant="primary"

              size="sm"

              onClick={() => { void syncNow(syncFolderPath) }}

            >

              {t('folderSyncSyncNow')}

            </Button>

          )}

        </div>



        {folderConnected && (

          <p className="text-micro settings-muted">

            {t('folderSyncFolderLabel')} <span className="font-mono text-micro break-all">{folderLabel}</span>

          </p>

        )}



        {syncEnabled && (

          <p className="text-micro settings-muted">

            {t('folderSyncStatusLabel')} {syncStatus.message || syncStatus.connection}

            {' · '}

            {t('folderSyncLastSyncLabel')} {formatLastSync(syncStatus.lastSyncAt, t('syncNeverSynced'))}

          </p>

        )}

      </div>

      <SyncConflictModal />

    </SettingsDisclosure>

  )

}

