import { useEffect } from 'react'
import { getLastBackupExportAt } from '../lib/backup/backupMetadata'
import { shouldRunAutoExport } from '../lib/shared/autoExportSchedule'

const RECHECK_MS = 6 * 60 * 60 * 1000

interface UseAutoExportOptions {
  enabled: boolean
  intervalDays: number
  isDataReady: boolean
  exportBackup: () => void | Promise<void>
}

export function useAutoExport({
  enabled,
  intervalDays,
  isDataReady,
  exportBackup,
}: UseAutoExportOptions) {
  useEffect(() => {
    if (!enabled || !isDataReady) return

    const maybeExport = () => {
      const lastExportAt = getLastBackupExportAt()
      if (!shouldRunAutoExport(lastExportAt, intervalDays)) return
      void Promise.resolve(exportBackup())
    }

    maybeExport()

    const intervalId = window.setInterval(maybeExport, RECHECK_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') maybeExport()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, intervalDays, isDataReady, exportBackup])
}
