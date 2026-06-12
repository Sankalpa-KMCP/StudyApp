import { useEffect, useRef } from 'react'
import { getLastBackupExportAt } from '../lib/backupMetadata'
import { shouldRunAutoExport } from '../lib/autoExportSchedule'

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
  const attemptedRef = useRef(false)

  useEffect(() => {
    if (!enabled || !isDataReady || attemptedRef.current) return

    const lastExportAt = getLastBackupExportAt()
    if (!shouldRunAutoExport(lastExportAt, intervalDays)) return

    attemptedRef.current = true
    void Promise.resolve(exportBackup())
  }, [enabled, intervalDays, isDataReady, exportBackup])
}
