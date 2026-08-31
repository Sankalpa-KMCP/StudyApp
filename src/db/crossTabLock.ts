export const DATABASE_LOCK_NAME = 'study-dashboard-db-lock'

export type LockMode = 'exclusive' | 'shared'

export class WebLocksUnavailableError extends Error {
  readonly code = 'WEB_LOCKS_UNAVAILABLE'

  constructor(message = 'Web Locks API is unavailable in this environment.') {
    super(message)
    this.name = 'WebLocksUnavailableError'
  }
}

export interface ILockManager {
  request<T>(name: string, mode: LockMode, callback: () => Promise<T>): Promise<T>
}

/**
 * Deterministic in-memory lock adapter for Node / Vitest testing.
 * Accurately models multiple concurrent shared holders, mutual exclusion
 * between shared and exclusive, serialization of exclusive requests,
 * and FIFO queuing without arbitrary timeouts or sleeps.
 */
export class InMemoryLockManager implements ILockManager {
  private activeMode: LockMode | null = null
  private activeHolders = 0
  private queue: Array<{
    mode: LockMode
    execute: () => void
  }> = []

  public async request<T>(name: string, mode: LockMode, callback: () => Promise<T>): Promise<T> {
    void name
    return new Promise<T>((resolve, reject) => {
      const task = () => {
        let resultPromise: Promise<T>
        try {
          resultPromise = callback()
        } catch (err) {
          this.release(mode)
          reject(err)
          return
        }

        resultPromise
          .then((value) => {
            this.release(mode)
            resolve(value)
          })
          .catch((err) => {
            this.release(mode)
            reject(err)
          })
      }

      if (this.canAcquireImmediately(mode)) {
        this.grant(mode)
        task()
      } else {
        this.queue.push({ mode, execute: task })
      }
    })
  }

  private canAcquireImmediately(mode: LockMode): boolean {
    if (this.queue.length > 0) {
      return false
    }
    if (this.activeHolders === 0) {
      return true
    }
    if (mode === 'shared' && this.activeMode === 'shared') {
      return true
    }
    return false
  }

  private grant(mode: LockMode): void {
    this.activeMode = mode
    this.activeHolders++
  }

  private release(mode: LockMode): void {
    void mode
    this.activeHolders--
    if (this.activeHolders === 0) {
      this.activeMode = null
    }
    this.pumpQueue()
  }

  private pumpQueue(): void {
    if (this.queue.length === 0) {
      return
    }

    const next = this.queue[0]
    if (next.mode === 'exclusive') {
      if (this.activeHolders === 0) {
        this.queue.shift()
        this.grant('exclusive')
        next.execute()
      }
      return
    }

    // Next is shared: if no active exclusive lock, grant all consecutive shared requests from head of queue
    if (this.activeMode === null || this.activeMode === 'shared') {
      while (this.queue.length > 0 && this.queue[0].mode === 'shared') {
        const item = this.queue.shift()!
        this.grant('shared')
        item.execute()
      }
    }
  }
}

let activeTestLockManager: ILockManager | null = null

export function setTestLockManager(adapter: ILockManager | null): void {
  activeTestLockManager = adapter
}

export function resetTestLockManager(): void {
  activeTestLockManager = null
}

export function installInMemoryLockAdapter(): InMemoryLockManager {
  const adapter = new InMemoryLockManager()
  setTestLockManager(adapter)
  return adapter
}

function hasWebLocks(): boolean {
  return (
    typeof navigator !== 'undefined'
    && typeof navigator.locks === 'object'
    && navigator.locks !== null
    && typeof navigator.locks.request === 'function'
  )
}

/**
 * DB-agnostic cross-tab lock execution.
 * Uses `navigator.locks.request` in browser environments or the injected test lock adapter in test suites.
 * Fails closed with `WebLocksUnavailableError` if Web Locks API is absent and no test adapter is installed.
 */
export async function withCrossTabLock<T>(
  mode: LockMode,
  action: () => Promise<T>,
  name: string = DATABASE_LOCK_NAME,
): Promise<T> {
  if (activeTestLockManager) {
    return activeTestLockManager.request(name, mode, action)
  }

  if (!hasWebLocks()) {
    throw new WebLocksUnavailableError()
  }

  return navigator.locks.request(name, { mode }, () => action())
}

export async function withExclusiveDatabaseLock<T>(action: () => Promise<T>): Promise<T> {
  return withCrossTabLock('exclusive', action)
}

export async function withSharedDatabaseLock<T>(action: () => Promise<T>): Promise<T> {
  return withCrossTabLock('shared', action)
}
