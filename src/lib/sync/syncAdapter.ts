export interface SyncFileMetadata {
  mtimeMs: number
  size: number
}

export interface SyncAdapter {
  isConnected(): Promise<boolean>
  readSyncFile(): Promise<string | null>
  writeSyncFile(content: string): Promise<void>
  getSyncFileMetadata(): Promise<SyncFileMetadata | null>
}
