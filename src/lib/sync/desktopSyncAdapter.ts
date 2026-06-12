import {
  getSyncFileMetadata,
  readSyncFile,
  writeSyncFile,
} from '../desktop/tauri'
import type { SyncAdapter } from './syncAdapter'

export function createDesktopSyncAdapter(folderPath: string): SyncAdapter {
  return {
    isConnected() {
      return Promise.resolve(Boolean(folderPath))
    },
    readSyncFile() {
      return readSyncFile(folderPath)
    },
    writeSyncFile(content: string) {
      return writeSyncFile(folderPath, content)
    },
    getSyncFileMetadata() {
      return getSyncFileMetadata(folderPath)
    },
  }
}
