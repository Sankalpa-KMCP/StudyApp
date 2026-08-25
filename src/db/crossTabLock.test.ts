import { describe, expect, it } from 'vitest'
import {
  InMemoryLockManager,
  resetTestLockManager,
  setTestLockManager,
  WebLocksUnavailableError,
  withCrossTabLock,
  withExclusiveDatabaseLock,
  withSharedDatabaseLock,
} from './crossTabLock'

describe('crossTabLock', () => {
  it('allows multiple shared operations to execute simultaneously', async () => {
    const lock = new InMemoryLockManager()
    setTestLockManager(lock)

    let shared1Active = false
    let shared2Active = false
    let maxConcurrent = 0

    let resolve1!: () => void
    let resolve2!: () => void
    const p1 = new Promise<void>((res) => { resolve1 = res })
    const p2 = new Promise<void>((res) => { resolve2 = res })

    const op1 = withSharedDatabaseLock(async () => {
      shared1Active = true
      if (shared2Active) maxConcurrent = 2
      await p1
      shared1Active = false
      return 'res1'
    })

    const op2 = withSharedDatabaseLock(async () => {
      shared2Active = true
      if (shared1Active) maxConcurrent = 2
      await p2
      shared2Active = false
      return 'res2'
    })

    // Both should start immediately
    expect(shared1Active).toBe(true)
    expect(shared2Active).toBe(true)
    expect(maxConcurrent).toBe(2)

    resolve1()
    resolve2()

    const results = await Promise.all([op1, op2])
    expect(results).toEqual(['res1', 'res2'])
  })

  it('makes exclusive lock wait for all active shared holders to release', async () => {
    const lock = new InMemoryLockManager()
    setTestLockManager(lock)

    let sharedRunning = true
    let exclusiveRanWhileSharedActive = false

    let resolveShared!: () => void
    const sharedGate = new Promise<void>((res) => { resolveShared = res })

    const sharedOp = withSharedDatabaseLock(async () => {
      await sharedGate
      sharedRunning = false
    })

    let exclusiveCompleted = false
    const exclusiveOp = withExclusiveDatabaseLock(async () => {
      if (sharedRunning) {
        exclusiveRanWhileSharedActive = true
      }
      exclusiveCompleted = true
      return 'exclusive-done'
    })

    expect(exclusiveCompleted).toBe(false)
    expect(sharedRunning).toBe(true)

    resolveShared()
    await sharedOp

    const result = await exclusiveOp
    expect(result).toBe('exclusive-done')
    expect(exclusiveCompleted).toBe(true)
    expect(exclusiveRanWhileSharedActive).toBe(false)
  })

  it('makes shared lock wait while exclusive lock is held', async () => {
    const lock = new InMemoryLockManager()
    setTestLockManager(lock)

    let exclusiveRunning = true
    let sharedRanWhileExclusiveActive = false

    let resolveExclusive!: () => void
    const exclusiveGate = new Promise<void>((res) => { resolveExclusive = res })

    const exclusiveOp = withExclusiveDatabaseLock(async () => {
      await exclusiveGate
      exclusiveRunning = false
    })

    let sharedCompleted = false
    const sharedOp = withSharedDatabaseLock(async () => {
      if (exclusiveRunning) {
        sharedRanWhileExclusiveActive = true
      }
      sharedCompleted = true
      return 'shared-done'
    })

    expect(sharedCompleted).toBe(false)
    expect(exclusiveRunning).toBe(true)

    resolveExclusive()
    await exclusiveOp

    const result = await sharedOp
    expect(result).toBe('shared-done')
    expect(sharedCompleted).toBe(true)
    expect(sharedRanWhileExclusiveActive).toBe(false)
  })

  it('serializes consecutive exclusive lock requests', async () => {
    const lock = new InMemoryLockManager()
    setTestLockManager(lock)

    const executionOrder: string[] = []
    let resolveFirst!: () => void
    const firstGate = new Promise<void>((res) => { resolveFirst = res })

    const first = withExclusiveDatabaseLock(async () => {
      executionOrder.push('first-start')
      await firstGate
      executionOrder.push('first-end')
    })

    const second = withExclusiveDatabaseLock(async () => {
      executionOrder.push('second-start')
      executionOrder.push('second-end')
    })

    expect(executionOrder).toEqual(['first-start'])

    resolveFirst()
    await Promise.all([first, second])

    expect(executionOrder).toEqual([
      'first-start',
      'first-end',
      'second-start',
      'second-end',
    ])
  })

  it('releases lock and allows waiting operations to proceed when callback throws', async () => {
    const lock = new InMemoryLockManager()
    setTestLockManager(lock)

    const failedOp = withExclusiveDatabaseLock(async () => {
      throw new Error('Lock action failed intentionally')
    })

    await expect(failedOp).rejects.toThrow('Lock action failed intentionally')

    // Next operation should acquire the lock without deadlock
    const nextOp = await withExclusiveDatabaseLock(async () => {
      return 'recovered'
    })
    expect(nextOp).toBe('recovered')
  })

  it('fails closed when Web Locks API is unavailable in production (no test adapter)', async () => {
    resetTestLockManager()

    // In Node / JSDOM without navigator.locks polyfill, it must throw WebLocksUnavailableError
    await expect(
      withCrossTabLock('exclusive', async () => 'should not run'),
    ).rejects.toThrow(WebLocksUnavailableError)

    await expect(
      withSharedDatabaseLock(async () => 'should not run'),
    ).rejects.toThrow(WebLocksUnavailableError)
  })
})
