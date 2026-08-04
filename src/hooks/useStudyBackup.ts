import { useCallback } from 'react'
import {
  clearAllStudyData,
  exportStudyData,
  importStudyData,
} from '../db/studyDb'
import type { ActiveFocusSession } from '../db/types'

export type UseStudyBackupOptions = {
  runWithFocusImportLock: <T>(action: () => Promise<T>) => Promise<T>
  reloadFocusFromIndexedDb: () => Promise<ActiveFocusSession | null>
  clearFocusLocalState: () => void
  /** Invoked only after successful persistent clear + local focus reset. */
  onClearSuccess: () => void
}

export type UseStudyBackupResult = {
  exportBackup: () => Promise<void>
  importBackup: (file: File) => Promise<void>
  clearAllBackup: () => Promise<void>
}

/**
 * Backup orchestration: browser export download, import-with-focus-lock,
 * and clear-all with post-success focus reset. Validation/transactions stay in studyDb.
 */
export function useStudyBackup({
  runWithFocusImportLock,
  reloadFocusFromIndexedDb,
  clearFocusLocalState,
  onClearSuccess,
}: UseStudyBackupOptions): UseStudyBackupResult {
  const exportBackup = useCallback(async () => {
    let objectUrl: string | null = null
    try {
      const payload = await exportStudyData()
      const serialized = JSON.stringify(payload, null, 2)
      const filename = `study-dashboard-${new Date().toISOString().slice(0, 10)}.json`
      const blob = new Blob([serialized], { type: 'application/json' })
      objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = filename
      anchor.click()
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [])

  const importBackup = useCallback(async (file: File) => {
    await runWithFocusImportLock(async () => {
      await importStudyData(JSON.parse(await file.text()) as unknown)
      await reloadFocusFromIndexedDb()
    })
  }, [reloadFocusFromIndexedDb, runWithFocusImportLock])

  const clearAllBackup = useCallback(async () => {
    await clearAllStudyData()
    clearFocusLocalState()
    onClearSuccess()
  }, [clearFocusLocalState, onClearSuccess])

  return {
    exportBackup,
    importBackup,
    clearAllBackup,
  }
}
