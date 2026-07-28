import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DataOperationCoordinator } from '../db/dataCoordinator'
import { useDataCoordinator } from './useDataCoordinator'

describe('useDataCoordinator', () => {
  it('AC-10: preserves coordinator instance across rerenders and reflects state transitions', async () => {
    const { result, rerender } = renderHook(() => useDataCoordinator())

    const initialCoordinator = result.current.coordinator
    expect(initialCoordinator).toBeInstanceOf(DataOperationCoordinator)
    expect(result.current.snapshot.activeDataOperation).toBe(null)

    rerender()
    expect(result.current.coordinator).toBe(initialCoordinator) // Instance stability

    let taskPromise: Promise<unknown>
    act(() => {
      taskPromise = initialCoordinator.runImport(async () => {
        // Pending action
      })
    })

    expect(result.current.snapshot.activeDataOperation).toBe('import')
    expect(result.current.snapshot.statusLabel).toBe('Importing backup…')

    await act(async () => {
      await taskPromise
    })

    expect(result.current.snapshot.activeDataOperation).toBe(null)
    expect(result.current.snapshot.statusLabel).toBe(null)
  })

  it('AC-10: subscribes to an existing supplied coordinator instance', async () => {
    const existing = new DataOperationCoordinator()
    const { result } = renderHook(() => useDataCoordinator(existing))

    expect(result.current.coordinator).toBe(existing)
    expect(result.current.snapshot.activeDataOperation).toBe(null)

    let taskPromise: Promise<unknown>
    act(() => {
      taskPromise = existing.runExport(async () => {
        // Pending export
      })
    })

    expect(result.current.snapshot.activeDataOperation).toBe('export')

    await act(async () => {
      await taskPromise
    })

    expect(result.current.snapshot.activeDataOperation).toBe(null)
  })
})
