import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoExport } from '../useAutoExport'

vi.mock('../../lib/backupMetadata', () => ({
  getLastBackupExportAt: vi.fn(),
}))

vi.mock('../../lib/autoExportSchedule', () => ({
  shouldRunAutoExport: vi.fn(),
}))

import { getLastBackupExportAt } from '../../lib/backupMetadata'
import { shouldRunAutoExport } from '../../lib/autoExportSchedule'

describe('useAutoExport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(getLastBackupExportAt).mockReturnValue(Date.now() - 8 * 24 * 60 * 60 * 1000)
    vi.mocked(shouldRunAutoExport).mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('exports on mount when due', () => {
    const exportBackup = vi.fn()
    renderHook(() =>
      useAutoExport({
        enabled: true,
        intervalDays: 7,
        isDataReady: true,
        exportBackup,
      }),
    )
    expect(exportBackup).toHaveBeenCalledTimes(1)
  })

  it('does not export when disabled', () => {
    const exportBackup = vi.fn()
    renderHook(() =>
      useAutoExport({
        enabled: false,
        intervalDays: 7,
        isDataReady: true,
        exportBackup,
      }),
    )
    expect(exportBackup).not.toHaveBeenCalled()
  })

  it('re-checks on visibility change when due', () => {
    const exportBackup = vi.fn()
    vi.mocked(shouldRunAutoExport).mockReturnValue(false)

    renderHook(() =>
      useAutoExport({
        enabled: true,
        intervalDays: 7,
        isDataReady: true,
        exportBackup,
      }),
    )
    expect(exportBackup).not.toHaveBeenCalled()

    vi.mocked(shouldRunAutoExport).mockReturnValue(true)
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(exportBackup).toHaveBeenCalledTimes(1)
  })

  it('re-checks on interval when due', () => {
    const exportBackup = vi.fn()
    vi.mocked(shouldRunAutoExport).mockReturnValue(false)

    renderHook(() =>
      useAutoExport({
        enabled: true,
        intervalDays: 7,
        isDataReady: true,
        exportBackup,
      }),
    )
    expect(exportBackup).not.toHaveBeenCalled()

    vi.mocked(shouldRunAutoExport).mockReturnValue(true)
    act(() => {
      vi.advanceTimersByTime(6 * 60 * 60 * 1000)
    })
    expect(exportBackup).toHaveBeenCalledTimes(1)
  })
})
