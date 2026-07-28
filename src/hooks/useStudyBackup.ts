import { useCallback } from 'react'
import type { IDataOperationCoordinator } from '../db/dataCoordinator'
import {
  clearAllStudyData,
  exportStudyData,
  importStudyData,
} from '../db/studyDb'
import {
  assertStudyExportImportFileSize,
  assertStudyExportImportTextLength,
} from '../db/studyExportLimits'
import type { ActiveFocusSession } from '../db/types'

export type UseStudyBackupOptions = {
  coordinator: IDataOperationCoordinator
  reloadFocusFromIndexedDb: () => Promise<ActiveFocusSession | null>
  clearFocusLocalState: () => void
  /** Invoked only after successful persistent clear + local focus reset. */
  onClearSuccess: () => void
}

export type BackupOperationResult =
  | { ok: true }
  | { ok: false; reason: 'busy' }

export type UseStudyBackupResult = {
  exportBackup: () => Promise<BackupOperationResult>
  importBackup: (file: File) => Promise<BackupOperationResult>
  clearAllBackup: () => Promise<BackupOperationResult>
}

/**
 * Backup orchestration: browser export download, import-with-focus-lock,
 * and clear-all with post-success focus reset. Validation/transactions stay in studyDb.
 */
export function useStudyBackup({
  coordinator,
  reloadFocusFromIndexedDb,
  clearFocusLocalState,
  onClearSuccess,
}: UseStudyBackupOptions): UseStudyBackupResult {
  const exportBackup = useCallback(async (): Promise<BackupOperationResult> => {
    let objectUrl: string | null = null
    const result = await coordinator.runExport(async () => {
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
    })
    if (!result.ok) {
      return { ok: false, reason: 'busy' }
    }
    return { ok: true }
  }, [coordinator])

  const importBackup = useCallback(async (file: File): Promise<BackupOperationResult> => {
    const result = await coordinator.runImport(async () => {
      assertStudyExportImportFileSize(file)
      const text = await file.text()
      assertStudyExportImportTextLength(text)
      await importStudyData(JSON.parse(text) as unknown)
      await reloadFocusFromIndexedDb()
    })
    if (!result.ok) {
      return { ok: false, reason: 'busy' }
    }
    return { ok: true }
  }, [coordinator, reloadFocusFromIndexedDb])

  const clearAllBackup = useCallback(async (): Promise<BackupOperationResult> => {
    const result = await coordinator.runDeleteAll(async () => {
      await clearAllStudyData()
      clearFocusLocalState()
      onClearSuccess()
    })
    if (!result.ok) {
      return { ok: false, reason: 'busy' }
    }
    return { ok: true }
  }, [clearFocusLocalState, coordinator, onClearSuccess])

  return {
    exportBackup,
    importBackup,
    clearAllBackup,
  }
}
