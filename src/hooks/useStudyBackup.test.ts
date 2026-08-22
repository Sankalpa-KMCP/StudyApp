import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DataOperationCoordinator } from '../db/dataCoordinator'
import * as studyDb from '../db/studyDb'
import {
  MAX_STUDY_EXPORT_IMPORT_BYTES,
  MAX_STUDY_EXPORT_IMPORT_CHARS,
  STUDY_EXPORT_IMPORT_SIZE_ERROR,
} from '../db/studyExportLimits'
import { StudyExportValidationError } from '../db/studyExportValidation'
import {
  DataOperationBusyError,
  isDataOperationBusyError,
  useStudyBackup,
} from './useStudyBackup'

function renderBackupHook(overrides: {
  coordinator?: DataOperationCoordinator
  runWithFocusImportLock?: <T>(action: () => Promise<T>) => Promise<T>
  reloadFocusFromIndexedDb?: () => Promise<null>
  clearFocusLocalState?: () => void
  onClearSuccess?: () => void
} = {}) {
  const coordinator = overrides.coordinator ?? new DataOperationCoordinator()
  const reloadFocusFromIndexedDb = overrides.reloadFocusFromIndexedDb ?? vi.fn(async () => null)
  const clearFocusLocalState = overrides.clearFocusLocalState ?? vi.fn()
  const onClearSuccess = overrides.onClearSuccess ?? vi.fn()
  const runWithFocusImportLock = overrides.runWithFocusImportLock
    ?? vi.fn(async <T,>(action: () => Promise<T>) => action())

  const { result } = renderHook(() => useStudyBackup({
    coordinator,
    runWithFocusImportLock,
    reloadFocusFromIndexedDb,
    clearFocusLocalState,
    onClearSuccess,
  }))

  return { result, coordinator, reloadFocusFromIndexedDb, clearFocusLocalState, onClearSuccess, runWithFocusImportLock }
}

describe('useStudyBackup', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exports a JSON backup download and revokes the object URL', async () => {
    const payload = {
      version: 4 as const,
      exportedAt: '2026-07-23T00:00:00.000Z',
      tasks: [],
      subjects: [],
      notes: [],
      events: [],
      studySessions: [],
      goals: [],
      settings: [],
    }
    vi.spyOn(studyDb, 'exportStudyData').mockResolvedValue(payload)
    const urlApi = URL as typeof URL & {
      createObjectURL: (blob: Blob) => string
      revokeObjectURL: (url: string) => void
    }
    urlApi.createObjectURL = vi.fn(() => 'blob:backup')
    urlApi.revokeObjectURL = vi.fn()
    const click = vi.fn()
    const anchor = { href: '', download: '', click } as unknown as HTMLAnchorElement
    const createElement = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') return anchor
      return Document.prototype.createElement.call(document, tag)
    }) as typeof document.createElement)

    const { result } = renderBackupHook()

    await result.current.exportBackup()

    expect(studyDb.exportStudyData).toHaveBeenCalledTimes(1)
    expect(urlApi.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    const blob = (urlApi.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob
    expect(blob.type).toBe('application/json')
    expect(anchor.download).toMatch(/^study-dashboard-\d{4}-\d{2}-\d{2}\.json$/)
    expect(click).toHaveBeenCalledTimes(1)
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:backup')
    createElement.mockRestore()
  })

  it('AC-1, AC-3: imports inside both coordinator and focus-import locks and reloads focus before release', async () => {
    const order: string[] = []
    vi.spyOn(studyDb, 'importStudyData').mockImplementation(async () => {
      order.push('import')
    })
    const reloadFocusFromIndexedDb = vi.fn(async () => {
      order.push('reload')
      return null
    })
    const runWithFocusImportLock = vi.fn(async <T,>(action: () => Promise<T>) => {
      order.push('focus-lock-start')
      try {
        return await action()
      } finally {
        order.push('focus-lock-end')
      }
    })

    const { result, coordinator } = renderBackupHook({ runWithFocusImportLock, reloadFocusFromIndexedDb })

    const file = new File([JSON.stringify({ version: 2 })], 'backup.json', { type: 'application/json' })
    await result.current.importBackup(file)

    expect(order).toEqual(['focus-lock-start', 'import', 'reload', 'focus-lock-end'])
    expect(runWithFocusImportLock).toHaveBeenCalledTimes(1)
    expect(reloadFocusFromIndexedDb).toHaveBeenCalledTimes(1)
    expect(coordinator.getSnapshot().activeDataOperation).toBe(null)
  })

  it('AC-5, AC-6: rejects with DataOperationBusyError when coordinator is busy', async () => {
    const coordinator = new DataOperationCoordinator()
    const importStudyData = vi.spyOn(studyDb, 'importStudyData').mockResolvedValue(undefined)
    const exportStudyData = vi.spyOn(studyDb, 'exportStudyData').mockResolvedValue({
      version: 4,
      exportedAt: '2026-07-28T00:00:00.000Z',
      tasks: [], subjects: [], notes: [], events: [], studySessions: [], goals: [], settings: [],
    })
    const clearAllStudyData = vi.spyOn(studyDb, 'clearAllStudyData').mockResolvedValue(undefined)

    const { result, reloadFocusFromIndexedDb, clearFocusLocalState, onClearSuccess, runWithFocusImportLock } = renderBackupHook({ coordinator })

    // Simulate an in-flight operation locking the coordinator
    let releaseHold!: () => void
    const holdPromise = new Promise<void>((res) => { releaseHold = res })
    void coordinator.runImport(async () => holdPromise)

    const file = new File(['{}'], 'test.json', { type: 'application/json' })
    const textSpy = vi.spyOn(file, 'text')

    const importErr = await result.current.importBackup(file).catch((e: unknown) => e)
    const exportErr = await result.current.exportBackup().catch((e: unknown) => e)
    const clearErr = await result.current.clearAllBackup().catch((e: unknown) => e)

    expect(isDataOperationBusyError(importErr)).toBe(true)
    expect(isDataOperationBusyError(exportErr)).toBe(true)
    expect(isDataOperationBusyError(clearErr)).toBe(true)

    expect(importErr).toBeInstanceOf(DataOperationBusyError)
    expect(exportErr).toBeInstanceOf(DataOperationBusyError)
    expect(clearErr).toBeInstanceOf(DataOperationBusyError)

    expect(textSpy).not.toHaveBeenCalled()
    expect(importStudyData).not.toHaveBeenCalled()
    expect(exportStudyData).not.toHaveBeenCalled()
    expect(clearAllStudyData).not.toHaveBeenCalled()
    expect(runWithFocusImportLock).not.toHaveBeenCalled()
    expect(reloadFocusFromIndexedDb).not.toHaveBeenCalled()
    expect(clearFocusLocalState).not.toHaveBeenCalled()
    expect(onClearSuccess).not.toHaveBeenCalled()

    releaseHold()
  })

  it('AC-4: releases both coordinator and focus-import locks after thrown import failure', async () => {
    const order: string[] = []
    vi.spyOn(studyDb, 'importStudyData').mockRejectedValue(new Error('invalid export'))
    const reloadFocusFromIndexedDb = vi.fn(async () => null)
    const runWithFocusImportLock = vi.fn(async <T,>(action: () => Promise<T>) => {
      order.push('focus-lock-start')
      try {
        return await action()
      } finally {
        order.push('focus-lock-end')
      }
    })

    const { result, coordinator } = renderBackupHook({ runWithFocusImportLock, reloadFocusFromIndexedDb })

    const file = new File(['{"version": 3}'], 'bad.json', { type: 'application/json' })
    await expect(result.current.importBackup(file)).rejects.toThrow('invalid export')
    expect(order).toEqual(['focus-lock-start', 'focus-lock-end'])
    expect(reloadFocusFromIndexedDb).not.toHaveBeenCalled()
    expect(coordinator.getSnapshot().activeDataOperation).toBe(null)
  })

  it('rejects an oversized file before reading text and releases both locks', async () => {
    const order: string[] = []
    const importStudyData = vi.spyOn(studyDb, 'importStudyData').mockResolvedValue(undefined)
    const textSpy = vi.spyOn(File.prototype, 'text')
    const parseSpy = vi.spyOn(JSON, 'parse')
    const reloadFocusFromIndexedDb = vi.fn(async () => null)
    const clearFocusLocalState = vi.fn()
    const runWithFocusImportLock = vi.fn(async <T,>(action: () => Promise<T>) => {
      order.push('focus-lock-start')
      try {
        return await action()
      } finally {
        order.push('focus-lock-end')
      }
    })

    const { result, coordinator } = renderBackupHook({
      runWithFocusImportLock,
      reloadFocusFromIndexedDb,
      clearFocusLocalState,
    })

    const file = new File(['tiny'], 'huge.json', { type: 'application/json' })
    Object.defineProperty(file, 'size', { value: MAX_STUDY_EXPORT_IMPORT_BYTES + 1 })

    await expect(result.current.importBackup(file)).rejects.toThrow(STUDY_EXPORT_IMPORT_SIZE_ERROR)
    expect(order).toEqual(['focus-lock-start', 'focus-lock-end'])
    expect(textSpy).not.toHaveBeenCalled()
    expect(parseSpy).not.toHaveBeenCalled()
    expect(importStudyData).not.toHaveBeenCalled()
    expect(reloadFocusFromIndexedDb).not.toHaveBeenCalled()
    expect(clearFocusLocalState).not.toHaveBeenCalled()
    expect(coordinator.getSnapshot().activeDataOperation).toBe(null)
  })

  it('rejects oversized text before JSON parse and database import', async () => {
    const importStudyData = vi.spyOn(studyDb, 'importStudyData').mockResolvedValue(undefined)
    const parseSpy = vi.spyOn(JSON, 'parse')
    const reloadFocusFromIndexedDb = vi.fn(async () => null)
    const clearFocusLocalState = vi.fn()

    const { result, coordinator } = renderBackupHook({
      reloadFocusFromIndexedDb,
      clearFocusLocalState,
    })

    const oversizedText = 'a'.repeat(MAX_STUDY_EXPORT_IMPORT_CHARS + 1)
    const file = {
      size: 16,
      text: vi.fn(async () => oversizedText),
    } as unknown as File

    await expect(result.current.importBackup(file)).rejects.toThrow(STUDY_EXPORT_IMPORT_SIZE_ERROR)
    expect(file.text).toHaveBeenCalledTimes(1)
    expect(parseSpy).not.toHaveBeenCalled()
    expect(importStudyData).not.toHaveBeenCalled()
    expect(reloadFocusFromIndexedDb).not.toHaveBeenCalled()
    expect(clearFocusLocalState).not.toHaveBeenCalled()
    expect(coordinator.getSnapshot().activeDataOperation).toBe(null)
  })

  it('allows a file at the byte-size boundary to reach the import path', async () => {
    const importStudyData = vi.spyOn(studyDb, 'importStudyData').mockResolvedValue(undefined)
    const reloadFocusFromIndexedDb = vi.fn(async () => null)
    const { result } = renderBackupHook({ reloadFocusFromIndexedDb })

    const payload = JSON.stringify({ version: 3 })
    const file = new File([payload], 'boundary.json', { type: 'application/json' })
    Object.defineProperty(file, 'size', { value: MAX_STUDY_EXPORT_IMPORT_BYTES })

    await result.current.importBackup(file)

    expect(importStudyData).toHaveBeenCalledTimes(1)
    expect(importStudyData).toHaveBeenCalledWith(payload)
    expect(reloadFocusFromIndexedDb).toHaveBeenCalledTimes(1)
  })

  it('allows an ordinary under-limit file to reach the import path', async () => {
    const importStudyData = vi.spyOn(studyDb, 'importStudyData').mockResolvedValue(undefined)
    const reloadFocusFromIndexedDb = vi.fn(async () => null)
    const { result } = renderBackupHook({ reloadFocusFromIndexedDb })

    const raw = JSON.stringify({ version: 1 })
    const file = new File([raw], 'ok.json', { type: 'application/json' })
    await result.current.importBackup(file)

    expect(file.size).toBeLessThanOrEqual(MAX_STUDY_EXPORT_IMPORT_BYTES)
    expect(importStudyData).toHaveBeenCalledWith(raw)
    expect(reloadFocusFromIndexedDb).toHaveBeenCalledTimes(1)
  })

  it('clears local focus and reports success only after persistent clear succeeds', async () => {
    const clearFocusLocalState = vi.fn()
    const onClearSuccess = vi.fn()
    vi.spyOn(studyDb, 'clearAllStudyData').mockResolvedValue(undefined)

    const { result, coordinator } = renderBackupHook({ clearFocusLocalState, onClearSuccess })

    await result.current.clearAllBackup()

    expect(studyDb.clearAllStudyData).toHaveBeenCalledTimes(1)
    expect(clearFocusLocalState).toHaveBeenCalledTimes(1)
    expect(onClearSuccess).toHaveBeenCalledTimes(1)
    expect(clearFocusLocalState.mock.invocationCallOrder[0]).toBeLessThan(onClearSuccess.mock.invocationCallOrder[0])
    expect(coordinator.getSnapshot().activeDataOperation).toBe(null)
  })

  it('preserves local focus state when persistent clear fails and releases coordinator lease', async () => {
    const clearFocusLocalState = vi.fn()
    const onClearSuccess = vi.fn()
    vi.spyOn(studyDb, 'clearAllStudyData').mockRejectedValue(new Error('clear failed'))

    const { result, coordinator } = renderBackupHook({ clearFocusLocalState, onClearSuccess })

    await expect(result.current.clearAllBackup()).rejects.toThrow('clear failed')
    expect(clearFocusLocalState).not.toHaveBeenCalled()
    expect(onClearSuccess).not.toHaveBeenCalled()
    expect(coordinator.getSnapshot().activeDataOperation).toBe(null)
  })

  it('18, 20. reloads focus state and returns cleanup warning when import succeeds with cleanup warning', async () => {
    vi.spyOn(studyDb, 'importStudyData').mockResolvedValue({ warning: 'cleanup_failed' })
    const reloadFocusFromIndexedDb = vi.fn(async () => null)
    const { result } = renderBackupHook({ reloadFocusFromIndexedDb })

    const file = new File([JSON.stringify({ version: 3 })], 'ok.json', { type: 'application/json' })
    const res = await result.current.importBackup(file)

    expect(res).toEqual({ warning: 'cleanup_failed' })
    expect(reloadFocusFromIndexedDb).toHaveBeenCalledTimes(1)
  })

  it('19. does not reload focus state when import throws validation or transaction error', async () => {
    vi.spyOn(studyDb, 'importStudyData').mockRejectedValue(
      new StudyExportValidationError('transaction_failed', 'Failed transaction')
    )
    const reloadFocusFromIndexedDb = vi.fn(async () => null)
    const { result } = renderBackupHook({ reloadFocusFromIndexedDb })

    const file = new File([JSON.stringify({ version: 3 })], 'ok.json', { type: 'application/json' })
    await expect(result.current.importBackup(file)).rejects.toThrow('Failed transaction')

    expect(reloadFocusFromIndexedDb).not.toHaveBeenCalled()
  })
})
