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
}

export function useSyncFolderDisplay({
  syncFolderPath,
  syncEnabled,
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
    let mounted = true
    void getWebSyncFolderLabel().then(label => {
      if (mounted) setWebFolderLabel(label)
    })
    return () => { mounted = false }
  }, [syncFolderPath, syncEnabled])

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
