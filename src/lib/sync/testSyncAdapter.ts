import type { SyncAdapter, SyncFileMetadata } from './syncAdapter'

export const E2E_SYNC_FOLDER_NAME = 'e2e-sync-folder'

export interface TestSyncAdapterController {
  setContent(content: string | null): void
  getContent(): string | null
  getWrittenContent(): string | null
  setConnected(connected: boolean): void
  setMetadata(metadata: SyncFileMetadata | null): void
  connectFolder(): void
  disconnectFolder(): void
  isFolderConnected(): boolean
  reset(): void
}

declare global {
  interface Window {
    __studySyncTestAdapter?: SyncAdapter
    __studySyncTestAdapterController?: TestSyncAdapterController
  }
}

let e2eFolderConnected = false

export function isE2eSyncMode(): boolean {
  return import.meta.env.VITE_E2E_SYNC === '1'
}

export function isE2eFolderConnected(): boolean {
  return e2eFolderConnected
}

export function createTestSyncAdapter(): SyncAdapter {
  let content: string | null = null
  let lastWritten: string | null = null
  let connected = true
  let metadata: SyncFileMetadata | null = null

  const controller: TestSyncAdapterController = {
    setContent(next) {
      content = next
      metadata = next
        ? { mtimeMs: Date.now(), size: next.length }
        : null
    },
    getContent() {
      return content
    },
    getWrittenContent() {
      return lastWritten
    },
    setConnected(next) {
      connected = next
    },
    setMetadata(next) {
      metadata = next
    },
    connectFolder() {
      e2eFolderConnected = true
    },
    disconnectFolder() {
      e2eFolderConnected = false
    },
    isFolderConnected() {
      return e2eFolderConnected
    },
    reset() {
      content = null
      lastWritten = null
      connected = true
      metadata = null
      e2eFolderConnected = false
    },
  }

  const adapter: SyncAdapter = {
    async isConnected() {
      return connected && e2eFolderConnected
    },
    async readSyncFile() {
      return content
    },
    async writeSyncFile(next) {
      content = next
      lastWritten = next
      metadata = { mtimeMs: Date.now(), size: next.length }
    },
    async getSyncFileMetadata() {
      if (metadata) return metadata
      if (!content) return null
      return { mtimeMs: Date.now(), size: content.length }
    },
  }

  window.__studySyncTestAdapter = adapter
  window.__studySyncTestAdapterController = controller

  return adapter
}

export function installTestSyncAdapter(): SyncAdapter {
  return createTestSyncAdapter()
}
