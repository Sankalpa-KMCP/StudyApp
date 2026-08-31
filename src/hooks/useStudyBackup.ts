import { useCallback } from 'react'
import type { IDataOperationCoordinator } from '../db/dataCoordinator'
import {
  clearAllStudyData,
  exportStudyData,
  importStudyData,
  type ImportStudyDataResult,
} from '../db/studyDb'
import {
  assertStudyExportImportFileSize,
  assertStudyExportImportTextLength,
} from '../db/studyExportLimits'
import { assertStudyExportRecordCounts } from '../db/studyExportValidation'
import type { ActiveFocusSession } from '../db/types'

export class DataOperationBusyError extends Error {
  readonly code = 'DATA_OPERATION_BUSY'
  constructor(message = 'Another data operation is currently in progress. Please wait for it to complete.') {
    super(message)
    this.name = 'DataOperationBusyError'
  }
}

export function isDataOperationBusyError(error: unknown): error is DataOperationBusyError {
  return (
    error instanceof DataOperationBusyError
    || (error instanceof Error && (error as Error & { code?: string }).code === 'DATA_OPERATION_BUSY')
  )
}

export type UseStudyBackupOptions = {
  coordinator: IDataOperationCoordinator
  runWithFocusImportLock: <T>(action: () => Promise<T>) => Promise<T>
  reloadFocusFromIndexedDb: () => Promise<ActiveFocusSession | null>
  clearFocusLocalState: () => void
  /** Invoked only after successful persistent clear + local focus reset. */
  onClearSuccess: () => void
}

export type UseStudyBackupResult = {
  exportBackup: () => Promise<void>
  importBackup: (file: File) => Promise<ImportStudyDataResult>
  clearAllBackup: () => Promise<void>
}

/**
 * Backup orchestration: browser export download, import-with-focus-lock,
 * and clear-all with post-success focus reset. Validation/transactions stay in studyDb.
 */
export function useStudyBackup({
  coordinator,
  runWithFocusImportLock,
  reloadFocusFromIndexedDb,
  clearFocusLocalState,
  onClearSuccess,
}: UseStudyBackupOptions): UseStudyBackupResult {
  const exportBackup = useCallback(async (): Promise<void> => {
    let objectUrl: string | null = null
    const result = await coordinator.runExport(async () => {
      try {
        const payload = await exportStudyData()
        assertStudyExportRecordCounts(payload)
        const serialized = JSON.stringify(payload, null, 2)
        assertStudyExportImportTextLength(serialized)
        const blob = new Blob([serialized], { type: 'application/json' })
        assertStudyExportImportFileSize(blob)
        const filename = `study-dashboard-${new Date().toISOString().slice(0, 10)}.json`
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
      throw new DataOperationBusyError('Another operation is in progress. Please wait for it to complete.')
    }
  }, [coordinator])

  const importBackup = useCallback(async (file: File): Promise<ImportStudyDataResult> => {
    let importResult: ImportStudyDataResult = {}
    const result = await coordinator.runImport(async () => {
      await runWithFocusImportLock(async () => {
        assertStudyExportImportFileSize(file)
        const text = await file.text()
        assertStudyExportImportTextLength(text)
        importResult = await importStudyData(text)
        await reloadFocusFromIndexedDb()
      })
    })
    if (!result.ok) {
      throw new DataOperationBusyError('Another operation is in progress. Please wait for it to complete.')
    }
    return importResult
  }, [coordinator, reloadFocusFromIndexedDb, runWithFocusImportLock])

  const clearAllBackup = useCallback(async (): Promise<void> => {
    const result = await coordinator.runDeleteAll(async () => {
      await clearAllStudyData()
      clearFocusLocalState()
      onClearSuccess()
    })
    if (!result.ok) {
      throw new DataOperationBusyError('Another operation is in progress. Please wait for it to complete.')
    }
  }, [clearFocusLocalState, coordinator, onClearSuccess])

  return {
    exportBackup,
    importBackup,
    clearAllBackup,
  }
}
