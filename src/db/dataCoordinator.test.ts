import { describe, expect, it, vi } from 'vitest'
import { DataOperationCoordinator } from './dataCoordinator'

function createControlledPromise<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('DataOperationCoordinator', () => {
  it('allows single operations to acquire and release', async () => {
    const coordinator = new DataOperationCoordinator()
    const { promise, resolve } = createControlledPromise<string>()

    const pending = coordinator.runImport(async () => promise)
    expect(coordinator.getSnapshot().activeDataOperation).toBe('import')
    expect(coordinator.getSnapshot().isPending).toBe(true)
    expect(coordinator.getSnapshot().statusLabel).toBe('Importing backup…')

    resolve('done')
    const result = await pending
    expect(result).toEqual({ ok: true, value: 'done' })
    expect(coordinator.getSnapshot().activeDataOperation).toBe(null)
    expect(coordinator.getSnapshot().isPending).toBe(false)
  })

  it('AC-1: blocks duplicate Import, Export, and Delete All attempts without calling action', async () => {
    const coordinator = new DataOperationCoordinator()
    const { promise, resolve } = createControlledPromise<void>()

    const importTask = coordinator.runImport(async () => promise)
    const duplicateAction = vi.fn().mockResolvedValue('duplicate')

    const dupImport = await coordinator.runImport(duplicateAction)
    const dupExport = await coordinator.runExport(duplicateAction)
    const dupClear = await coordinator.runDeleteAll(duplicateAction)

    expect(dupImport).toEqual({ ok: false, reason: 'busy' })
    expect(dupExport).toEqual({ ok: false, reason: 'busy' })
    expect(dupClear).toEqual({ ok: false, reason: 'busy' })
    expect(duplicateAction).not.toHaveBeenCalled()

    resolve()
    await importTask
  })

  it('AC-1: blocks overlapping Settings operations in both start orders', async () => {
    // Export then Import / Delete All
    const coordinator1 = new DataOperationCoordinator()
    const exportCtrl = createControlledPromise<void>()
    const exportTask = coordinator1.runExport(async () => exportCtrl.promise)

    const blockedAction = vi.fn().mockResolvedValue('blocked')
    expect(await coordinator1.runImport(blockedAction)).toEqual({ ok: false, reason: 'busy' })
    expect(await coordinator1.runDeleteAll(blockedAction)).toEqual({ ok: false, reason: 'busy' })
    expect(blockedAction).not.toHaveBeenCalled()

    exportCtrl.resolve()
    await exportTask

    // Delete All then Import / Export
    const coordinator2 = new DataOperationCoordinator()
    const clearCtrl = createControlledPromise<void>()
    const clearTask = coordinator2.runDeleteAll(async () => clearCtrl.promise)

    expect(await coordinator2.runImport(blockedAction)).toEqual({ ok: false, reason: 'busy' })
    expect(await coordinator2.runExport(blockedAction)).toEqual({ ok: false, reason: 'busy' })
    expect(blockedAction).not.toHaveBeenCalled()

    clearCtrl.resolve()
    await clearTask
  })

  it('AC-2: blocks Import and Delete All while one or more focus writes are active', async () => {
    const coordinator = new DataOperationCoordinator()
    const focusCtrl = createControlledPromise<void>()
    const focusTask = coordinator.runFocusWrite(async () => focusCtrl.promise)

    expect(coordinator.getSnapshot().canImport).toBe(false)
    expect(coordinator.getSnapshot().canClear).toBe(false)

    const blockedAction = vi.fn().mockResolvedValue('blocked')
    expect(await coordinator.runImport(blockedAction)).toEqual({ ok: false, reason: 'busy' })
    expect(await coordinator.runDeleteAll(blockedAction)).toEqual({ ok: false, reason: 'busy' })
    expect(blockedAction).not.toHaveBeenCalled()

    focusCtrl.resolve()
    await focusTask

    expect(coordinator.getSnapshot().canImport).toBe(true)
    expect(coordinator.getSnapshot().canClear).toBe(true)
  })

  it('AC-3: blocks focus writes during Import or Delete All', async () => {
    const coordinator = new DataOperationCoordinator()
    const importCtrl = createControlledPromise<void>()
    const importTask = coordinator.runImport(async () => importCtrl.promise)

    expect(coordinator.getSnapshot().canMutateFocus).toBe(false)
    const blockedAction = vi.fn().mockResolvedValue('blocked')
    expect(await coordinator.runFocusWrite(blockedAction)).toEqual({ ok: false, reason: 'busy' })
    expect(blockedAction).not.toHaveBeenCalled()

    importCtrl.resolve()
    await importTask

    expect(coordinator.getSnapshot().canMutateFocus).toBe(true)
  })

  it('AC-4: permits Export and focus writes to overlap symmetrically regardless of start order', async () => {
    // Focus write first, then Export -> ALLOW
    const coordinator1 = new DataOperationCoordinator()
    const focusCtrl = createControlledPromise<string>()
    const exportCtrl = createControlledPromise<string>()

    const focusTask = coordinator1.runFocusWrite(async () => focusCtrl.promise)
    const exportTask = coordinator1.runExport(async () => exportCtrl.promise)

    expect(coordinator1.getSnapshot().activeDataOperation).toBe('export')
    expect(coordinator1.getSnapshot().activeFocusWriteCount).toBe(1)

    focusCtrl.resolve('focus_done')
    exportCtrl.resolve('export_done')

    expect(await focusTask).toEqual({ ok: true, value: 'focus_done' })
    expect(await exportTask).toEqual({ ok: true, value: 'export_done' })

    // Export first, then Focus write -> ALLOW
    const coordinator2 = new DataOperationCoordinator()
    const exportCtrl2 = createControlledPromise<string>()
    const focusCtrl2 = createControlledPromise<string>()

    const exportTask2 = coordinator2.runExport(async () => exportCtrl2.promise)
    const focusTask2 = coordinator2.runFocusWrite(async () => focusCtrl2.promise)

    expect(coordinator2.getSnapshot().activeDataOperation).toBe('export')
    expect(coordinator2.getSnapshot().activeFocusWriteCount).toBe(1)

    exportCtrl2.resolve('export_done')
    focusCtrl2.resolve('focus_done')

    expect(await exportTask2).toEqual({ ok: true, value: 'export_done' })
    expect(await focusTask2).toEqual({ ok: true, value: 'focus_done' })
  })

  it('AC-5: tracks multiple compatible focus writes correctly and releases independently', async () => {
    const coordinator = new DataOperationCoordinator()
    const focusCtrl1 = createControlledPromise<void>()
    const focusCtrl2 = createControlledPromise<void>()

    const task1 = coordinator.runFocusWrite(async () => focusCtrl1.promise)
    expect(coordinator.getSnapshot().activeFocusWriteCount).toBe(1)

    const task2 = coordinator.runFocusWrite(async () => focusCtrl2.promise)
    expect(coordinator.getSnapshot().activeFocusWriteCount).toBe(2)

    focusCtrl1.resolve()
    await task1
    expect(coordinator.getSnapshot().activeFocusWriteCount).toBe(1)

    focusCtrl2.resolve()
    await task2
    expect(coordinator.getSnapshot().activeFocusWriteCount).toBe(0)
  })

  it('AC-7: releases lock after thrown synchronous error and rejected promise', async () => {
    const coordinator = new DataOperationCoordinator()

    // Synchronous throw
    await expect(
      coordinator.runImport(async () => {
        throw new Error('Sync boom')
      }),
    ).rejects.toThrow('Sync boom')

    expect(coordinator.getSnapshot().activeDataOperation).toBe(null)

    // Rejected promise
    await expect(
      coordinator.runDeleteAll(async () => Promise.reject(new Error('Async boom'))),
    ).rejects.toThrow('Async boom')

    expect(coordinator.getSnapshot().activeDataOperation).toBe(null)

    // Focus write rejected promise
    await expect(
      coordinator.runFocusWrite(async () => Promise.reject(new Error('Focus boom'))),
    ).rejects.toThrow('Focus boom')

    expect(coordinator.getSnapshot().activeFocusWriteCount).toBe(0)
  })

  it('AC-8: notifies subscribers on state transitions and unsubscribes cleanly', async () => {
    const coordinator = new DataOperationCoordinator()
    const listener = vi.fn()
    const unsubscribe = coordinator.subscribe(listener)

    const ctrl = createControlledPromise<void>()
    const task = coordinator.runImport(async () => ctrl.promise)
    expect(listener).toHaveBeenCalledTimes(1)

    ctrl.resolve()
    await task
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    const ctrl2 = createControlledPromise<void>()
    const task2 = coordinator.runExport(async () => ctrl2.promise)
    ctrl2.resolve()
    await task2
    expect(listener).toHaveBeenCalledTimes(2) // No new calls after unsubscribe
  })

  it('AC-9: preserves snapshot identity when unchanged and creates new reference on state transition', async () => {
    const coordinator = new DataOperationCoordinator()
    const snap1 = coordinator.getSnapshot()
    const snap2 = coordinator.getSnapshot()

    expect(snap1).toBe(snap2) // Exact object identity match

    const ctrl = createControlledPromise<void>()
    const task = coordinator.runExport(async () => ctrl.promise)
    const snap3 = coordinator.getSnapshot()

    expect(snap3).not.toBe(snap1) // New snapshot reference after transition
    expect(snap3.activeDataOperation).toBe('export')

    ctrl.resolve()
    await task
    const snap4 = coordinator.getSnapshot()
    expect(snap4).not.toBe(snap3)
    expect(snap4.activeDataOperation).toBe(null)
  })
})
