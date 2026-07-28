export type SettingsDataOperation = 'import' | 'export' | 'deleteAll'

export type DataCoordinatorSnapshot = {
  activeDataOperation: SettingsDataOperation | null
  activeFocusWriteCount: number
  isPending: boolean
  canImport: boolean
  canExport: boolean
  canClear: boolean
  canMutateFocus: boolean
  statusLabel: 'Importing backup…' | 'Creating backup…' | 'Deleting study data…' | null
}

export type AcquisitionResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'busy' }

export interface IDataOperationCoordinator {
  getSnapshot: () => DataCoordinatorSnapshot
  subscribe: (listener: () => void) => () => void
  runImport: <T>(action: () => Promise<T>) => Promise<AcquisitionResult<T>>
  runDeleteAll: <T>(action: () => Promise<T>) => Promise<AcquisitionResult<T>>
  runExport: <T>(action: () => Promise<T>) => Promise<AcquisitionResult<T>>
  runFocusWrite: <T>(action: () => Promise<T>) => Promise<AcquisitionResult<T>>
}

/**
 * Framework-independent coordinator for shared Settings data operations and focus writes.
 * Enforces exclusive locks for Import and Delete All, shared read lock for Export,
 * and mutual exclusion with focus session writes.
 */
export class DataOperationCoordinator implements IDataOperationCoordinator {
  private activeDataOperation: SettingsDataOperation | null = null
  private activeFocusWriteCount = 0
  private listeners = new Set<() => void>()
  private snapshot: DataCoordinatorSnapshot

  constructor() {
    this.snapshot = this.computeSnapshot()
  }

  private computeSnapshot(): DataCoordinatorSnapshot {
    const isMutatingData = this.activeDataOperation === 'import' || this.activeDataOperation === 'deleteAll'
    return {
      activeDataOperation: this.activeDataOperation,
      activeFocusWriteCount: this.activeFocusWriteCount,
      isPending: this.activeDataOperation !== null,
      canImport: this.activeDataOperation === null && this.activeFocusWriteCount === 0,
      canExport: this.activeDataOperation === null,
      canClear: this.activeDataOperation === null && this.activeFocusWriteCount === 0,
      canMutateFocus: !isMutatingData,
      statusLabel:
        this.activeDataOperation === 'import'
          ? 'Importing backup…'
          : this.activeDataOperation === 'export'
            ? 'Creating backup…'
            : this.activeDataOperation === 'deleteAll'
              ? 'Deleting study data…'
              : null,
    }
  }

  private updateState(updater: () => void) {
    updater()
    this.snapshot = this.computeSnapshot()
    this.listeners.forEach((listener) => listener())
  }

  public getSnapshot = (): DataCoordinatorSnapshot => {
    return this.snapshot
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public async runImport<T>(action: () => Promise<T>): Promise<AcquisitionResult<T>> {
    if (this.activeDataOperation !== null || this.activeFocusWriteCount > 0) {
      return { ok: false, reason: 'busy' }
    }
    this.updateState(() => {
      this.activeDataOperation = 'import'
    })
    try {
      const value = await action()
      return { ok: true, value }
    } finally {
      this.updateState(() => {
        this.activeDataOperation = null
      })
    }
  }

  public async runDeleteAll<T>(action: () => Promise<T>): Promise<AcquisitionResult<T>> {
    if (this.activeDataOperation !== null || this.activeFocusWriteCount > 0) {
      return { ok: false, reason: 'busy' }
    }
    this.updateState(() => {
      this.activeDataOperation = 'deleteAll'
    })
    try {
      const value = await action()
      return { ok: true, value }
    } finally {
      this.updateState(() => {
        this.activeDataOperation = null
      })
    }
  }

  public async runExport<T>(action: () => Promise<T>): Promise<AcquisitionResult<T>> {
    if (this.activeDataOperation !== null) {
      return { ok: false, reason: 'busy' }
    }
    this.updateState(() => {
      this.activeDataOperation = 'export'
    })
    try {
      const value = await action()
      return { ok: true, value }
    } finally {
      this.updateState(() => {
        this.activeDataOperation = null
      })
    }
  }

  public async runFocusWrite<T>(action: () => Promise<T>): Promise<AcquisitionResult<T>> {
    if (this.activeDataOperation === 'import' || this.activeDataOperation === 'deleteAll') {
      return { ok: false, reason: 'busy' }
    }
    this.updateState(() => {
      this.activeFocusWriteCount++
    })
    try {
      const value = await action()
      return { ok: true, value }
    } finally {
      this.updateState(() => {
        this.activeFocusWriteCount--
      })
    }
  }
}
