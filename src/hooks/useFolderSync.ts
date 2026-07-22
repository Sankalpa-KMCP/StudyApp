import { useEffect } from 'react'
import {
  getWebSyncFolderLabel,
  startSyncOrchestrator,
  stopSyncOrchestrator,
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
}
