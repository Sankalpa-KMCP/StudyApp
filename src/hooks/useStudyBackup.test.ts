import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as studyDb from '../db/studyDb'
import { useStudyBackup } from './useStudyBackup'

describe('useStudyBackup', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exports a JSON backup download and revokes the object URL', async () => {
    const payload = {
      version: 2 as const,
      exportedAt: '2026-07-23T00:00:00.000Z',
      tasks: [],
      subjects: [],
      notes: [],
      events: [],
      flashcards: [],
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

    const { result } = renderHook(() => useStudyBackup({
      runWithFocusImportLock: async (action) => action(),
      reloadFocusFromIndexedDb: vi.fn(),
      clearFocusLocalState: vi.fn(),
      onClearSuccess: vi.fn(),
    }))

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

  it('imports inside the focus lock and reloads focus only after successful replacement', async () => {
    const order: string[] = []
    vi.spyOn(studyDb, 'importStudyData').mockImplementation(async () => {
      order.push('import')
    })
    const reloadFocusFromIndexedDb = vi.fn(async () => {
      order.push('reload')
      return null
    })
    const runWithFocusImportLock = vi.fn(async <T,>(action: () => Promise<T>) => {
      order.push('lock-start')
      try {
        return await action()
      } finally {
        order.push('lock-end')
      }
    })

    const { result } = renderHook(() => useStudyBackup({
      runWithFocusImportLock,
      reloadFocusFromIndexedDb,
      clearFocusLocalState: vi.fn(),
      onClearSuccess: vi.fn(),
    }))

    const file = new File([JSON.stringify({ version: 2 })], 'backup.json', { type: 'application/json' })
    await result.current.importBackup(file)

    expect(order).toEqual(['lock-start', 'import', 'reload', 'lock-end'])
    expect(runWithFocusImportLock).toHaveBeenCalledTimes(1)
    expect(reloadFocusFromIndexedDb).toHaveBeenCalledTimes(1)
  })

  it('does not reload focus when import validation fails and still releases the lock', async () => {
    const order: string[] = []
    vi.spyOn(studyDb, 'importStudyData').mockRejectedValue(new Error('invalid export'))
    const reloadFocusFromIndexedDb = vi.fn(async () => {
      order.push('reload')
      return null
    })
    const runWithFocusImportLock = vi.fn(async <T,>(action: () => Promise<T>) => {
      order.push('lock-start')
      try {
        return await action()
      } finally {
        order.push('lock-end')
      }
    })

    const { result } = renderHook(() => useStudyBackup({
      runWithFocusImportLock,
      reloadFocusFromIndexedDb,
      clearFocusLocalState: vi.fn(),
      onClearSuccess: vi.fn(),
    }))

    const file = new File(['{'], 'bad.json', { type: 'application/json' })
    await expect(result.current.importBackup(file)).rejects.toThrow()
    expect(order).toEqual(['lock-start', 'lock-end'])
    expect(reloadFocusFromIndexedDb).not.toHaveBeenCalled()
  })

  it('clears local focus and reports success only after persistent clear succeeds', async () => {
    const clearFocusLocalState = vi.fn()
    const onClearSuccess = vi.fn()
    vi.spyOn(studyDb, 'clearAllStudyData').mockResolvedValue(undefined)

    const { result } = renderHook(() => useStudyBackup({
      runWithFocusImportLock: async (action) => action(),
      reloadFocusFromIndexedDb: vi.fn(),
      clearFocusLocalState,
      onClearSuccess,
    }))

    await result.current.clearAllBackup()

    expect(studyDb.clearAllStudyData).toHaveBeenCalledTimes(1)
    expect(clearFocusLocalState).toHaveBeenCalledTimes(1)
    expect(onClearSuccess).toHaveBeenCalledTimes(1)
    expect(clearFocusLocalState.mock.invocationCallOrder[0]).toBeLessThan(onClearSuccess.mock.invocationCallOrder[0])
  })

  it('preserves local focus state when persistent clear fails', async () => {
    const clearFocusLocalState = vi.fn()
    const onClearSuccess = vi.fn()
    vi.spyOn(studyDb, 'clearAllStudyData').mockRejectedValue(new Error('clear failed'))

    const { result } = renderHook(() => useStudyBackup({
      runWithFocusImportLock: async (action) => action(),
      reloadFocusFromIndexedDb: vi.fn(),
      clearFocusLocalState,
      onClearSuccess,
    }))

    await expect(result.current.clearAllBackup()).rejects.toThrow('clear failed')
    expect(clearFocusLocalState).not.toHaveBeenCalled()
    expect(onClearSuccess).not.toHaveBeenCalled()
  })
})
