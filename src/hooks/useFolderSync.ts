import { useEffect, useState } from 'react'
import {
  getWebSyncFolderLabel,
  startSyncOrchestrator,
  stopSyncOrchestrator,
  subscribeSyncStatus,
  type SyncStatusSnapshot,
} from '../lib/sync'
import { isTauri } from '../lib/desktop/tauri'

interface UseFolderSyncOptions {
  syncEnabled: boolean
  syncFolderPath: string
  isDataReady: boolean
}

export function useFolderSync({
  syncEnabled,
  syncFolderPath,
  isDataReady,
}: UseFolderSyncOptions) {
  const [syncStatus, setSyncStatus] = useState<SyncStatusSnapshot>(() => ({
    connection: 'disconnected',
    lastSyncAt: '',
    message: '',
  }))
  const [webFolderLabel, setWebFolderLabel] = useState('')

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
    if (!isDataReady || isTauri()) return
    let mounted = true
    void getWebSyncFolderLabel().then(label => {
      if (mounted) setWebFolderLabel(label)
    })
    return () => { mounted = false }
  }, [isDataReady, syncFolderPath, syncEnabled])

  useEffect(() => {
    if (!isDataReady || !syncEnabled) {
      stopSyncOrchestrator()
      return
    }

    let cancelled = false

    async function start() {
      if (!isTauri()) {
        const label = await getWebSyncFolderLabel()
        if (cancelled) return
        setWebFolderLabel(label)
        if (!label && !syncFolderPath) {
          stopSyncOrchestrator()
          return
        }
      } else if (!syncFolderPath) {
        stopSyncOrchestrator()
        return
      }

      void startSyncOrchestrator(syncFolderPath)
    }

    void start()

    return () => {
      cancelled = true
      stopSyncOrchestrator()
    }
  }, [isDataReady, syncEnabled, syncFolderPath])

  const folderConnected = isTauri()
    ? Boolean(syncFolderPath)
    : Boolean(webFolderLabel)

  return {
    syncStatus,
    webFolderLabel,
    folderConnected,
  }
}
