import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSyncFolderDisplay } from '../useSyncFolderDisplay'

const subscribeSyncStatus = vi.fn()
const getWebSyncFolderLabel = vi.fn()

vi.mock('../../lib/sync', () => ({
  subscribeSyncStatus: (...args: unknown[]) => subscribeSyncStatus(...args),
  getWebSyncFolderLabel: (...args: unknown[]) => getWebSyncFolderLabel(...args),
}))

vi.mock('../../lib/desktop/tauri', () => ({
  isTauri: () => false,
}))

describe('useSyncFolderDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscribeSyncStatus.mockImplementation(listener => {
      listener({
        connection: 'connected',
        lastSyncAt: '2026-06-12T12:00:00.000Z',
        message: 'Ready',
      })
      return () => {}
    })
    getWebSyncFolderLabel.mockResolvedValue('study-sync')
  })

  it('subscribes to sync status once and exposes the current snapshot', () => {
    const { result } = renderHook(() =>
      useSyncFolderDisplay({
        syncFolderPath: 'study-sync',
        syncEnabled: true,
      }),
    )

    expect(subscribeSyncStatus).toHaveBeenCalledTimes(1)
    expect(result.current.syncStatus).toEqual({
      connection: 'connected',
      lastSyncAt: '2026-06-12T12:00:00.000Z',
      message: 'Ready',
    })
  })

  it('resolves the web folder label for display', async () => {
    const { result } = renderHook(() =>
      useSyncFolderDisplay({
        syncFolderPath: 'study-sync',
        syncEnabled: true,
      }),
    )

    await waitFor(() => {
      expect(result.current.webFolderLabel).toBe('study-sync')
    })
    expect(getWebSyncFolderLabel).toHaveBeenCalled()
    expect(result.current.folderConnected).toBe(true)
    expect(result.current.folderLabel).toBe('study-sync')
  })

  it('skips web folder label fetch until data is ready when required', async () => {
    renderHook(() =>
      useSyncFolderDisplay({
        syncFolderPath: '',
        syncEnabled: true,
        requireDataReady: true,
        isDataReady: false,
      }),
    )

    await waitFor(() => {
      expect(getWebSyncFolderLabel).not.toHaveBeenCalled()
    })
  })
})
