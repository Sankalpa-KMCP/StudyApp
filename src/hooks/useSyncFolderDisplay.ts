import { useEffect, useState } from 'react'
import {
  getWebSyncFolderLabel,
  subscribeSyncStatus,
  type SyncStatusSnapshot,
} from '../lib/sync'
import { isTauri } from '../lib/desktop/tauri'

interface UseSyncFolderDisplayOptions {
  syncFolderPath: string
  syncEnabled: boolean
  /** When true, the web folder label is fetched only after `isDataReady` is true. */
  requireDataReady?: boolean
  isDataReady?: boolean
}

export function useSyncFolderDisplay({
  syncFolderPath,
  syncEnabled,
  requireDataReady = false,
  isDataReady = true,
}: UseSyncFolderDisplayOptions) {
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
    if (isTauri()) return
    if (requireDataReady && !isDataReady) return
    let mounted = true
    void getWebSyncFolderLabel().then(label => {
      if (mounted) setWebFolderLabel(label)
    })
    return () => { mounted = false }
  }, [requireDataReady, isDataReady, syncFolderPath, syncEnabled])

  const folderLabel = isTauri() ? syncFolderPath : webFolderLabel
  const folderConnected = Boolean(folderLabel)

  return {
    syncStatus,
    webFolderLabel,
    setWebFolderLabel,
    folderLabel,
    folderConnected,
  }
}
