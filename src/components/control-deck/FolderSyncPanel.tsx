import { useEffect, useState } from 'react'
import { useSettingsPanel } from './SettingsPanelContext'
import { SettingsDisclosure } from '../shared/settings/SettingsDisclosure'
import { ToggleSetting } from '../shared/settings/ToggleSetting'
import { Button } from '../shared/Button'
import { isTauri, pickSyncFolder } from '../../lib/desktop/tauri'
import {
  connectSyncFolder,
  disconnectSyncFolder,
  getWebSyncFolderLabel,
  isFileSystemAccessSupported,
  syncNow,
} from '../../lib/sync'
import { subscribeSyncStatus, type SyncStatusSnapshot } from '../../lib/sync/syncState'

function formatLastSync(lastSyncAt: string): string {
  if (!lastSyncAt) return 'Never synced'
  const date = new Date(lastSyncAt)
  if (Number.isNaN(date.getTime())) return 'Never synced'
  return date.toLocaleString()
}

export function FolderSyncPanel() {
  const {
    syncEnabled,
    syncFolderPath,
    updateSetting,
    pushToast,
  } = useSettingsPanel()

  const [syncStatus, setSyncStatus] = useState<SyncStatusSnapshot>({
    connection: 'disconnected',
    lastSyncAt: '',
    message: '',
  })
  const [webFolderLabel, setWebFolderLabel] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    let mounted = true
    const unsubscribe = subscribeSyncStatus(snapshot => {
      if (mounted) setSyncStatus(snapshot)
    })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (isTauri()) return
    let mounted = true
    void getWebSyncFolderLabel().then(label => {
      if (mounted) setWebFolderLabel(label)
    })
    return () => { mounted = false }
  }, [syncFolderPath, syncEnabled])

  const folderLabel = isTauri() ? syncFolderPath : webFolderLabel
  const folderConnected = Boolean(folderLabel)
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
        pushToast('SYNC', 'Folder sync requires Chrome or Edge on desktop')
        return
      }

      const handle = await connectSyncFolder()
      if (handle) {
        setWebFolderLabel(handle.name)
        updateSetting('syncFolderPath', handle.name)
        pushToast('SYNC', `Connected to folder "${handle.name}"`)
      }
    } catch (err) {
      console.error('Failed to connect sync folder:', err)
      pushToast('SYNC', 'Could not connect sync folder')
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
    <SettingsDisclosure title="Folder sync (web + desktop)" defaultOpen={false}>
      <div className="rounded-2xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] p-4 space-y-4">
        <p className="settings-muted text-[11px] leading-relaxed">
          Keep the GitHub Pages site and desktop app in sync by pointing both at the same folder on your PC.
          Data is shared through <span className="font-mono">study-vault.sync.studybackup</span>.
          Use the same folder in both clients (for example <span className="font-mono">Documents/StudyDashboard</span>).
        </p>

        {!isTauri() && !fsAccessSupported && (
          <p className="text-[11px] status-banner-warning-body">
            Folder sync in the browser requires Chrome or Edge over HTTPS. Use manual backup import/export on other browsers.
          </p>
        )}

        <ToggleSetting
          label="Enable folder sync"
          description="Automatically sync study data to a shared folder on this computer."
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
            {folderConnected ? 'Change sync folder' : 'Choose sync folder'}
          </Button>
          {folderConnected && (
            <Button variant="secondary" size="sm" onClick={() => { void handleDisconnect() }}>
              Disconnect
            </Button>
          )}
          {syncEnabled && folderConnected && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => { void syncNow(syncFolderPath) }}
            >
              Sync now
            </Button>
          )}
        </div>

        {folderConnected && (
          <p className="text-micro settings-muted">
            Folder: <span className="font-mono text-micro break-all">{folderLabel}</span>
          </p>
        )}

        {syncEnabled && (
          <p className="text-micro settings-muted">
            Status: {syncStatus.message || syncStatus.connection}
            {' · '}
            Last sync: {formatLastSync(syncStatus.lastSyncAt)}
          </p>
        )}
      </div>
    </SettingsDisclosure>
  )
}
