import {
  clearDirectorySyncHandle,
  getDirectorySyncHandle,
  saveDirectorySyncHandle,
} from '../../db/repositories/syncHandles'
import { SYNC_FILE_NAME } from './syncConstants'
import type { SyncAdapter, SyncFileMetadata } from './syncAdapter'

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function ensureDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode = 'readwrite',
): Promise<boolean> {
  const options = { mode }
  if ((await handle.queryPermission(options)) === 'granted') return true
  return (await handle.requestPermission(options)) === 'granted'
}

export async function connectSyncFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) return null
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  const granted = await ensureDirectoryPermission(handle, 'readwrite')
  if (!granted) return null
  await saveDirectorySyncHandle(handle)
  return handle
}

export async function disconnectSyncFolder(): Promise<void> {
  await clearDirectorySyncHandle()
}

async function getSyncFileHandle(
  handle: FileSystemDirectoryHandle,
  create: boolean,
): Promise<FileSystemFileHandle | null> {
  try {
    return await handle.getFileHandle(SYNC_FILE_NAME, { create })
  } catch {
    return null
  }
}

export async function readSyncFileFromHandle(handle: FileSystemDirectoryHandle): Promise<string | null> {
  const fileHandle = await getSyncFileHandle(handle, false)
  if (!fileHandle) return null
  const file = await fileHandle.getFile()
  if (file.size === 0) return null
  return file.text()
}

export async function writeSyncFileToHandle(
  handle: FileSystemDirectoryHandle,
  content: string,
): Promise<void> {
  const fileHandle = await getSyncFileHandle(handle, true)
  if (!fileHandle) throw new Error('Could not open sync file for writing')
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
}

export async function getSyncFileMetadataFromHandle(
  handle: FileSystemDirectoryHandle,
): Promise<SyncFileMetadata | null> {
  const fileHandle = await getSyncFileHandle(handle, false)
  if (!fileHandle) return null
  const file = await fileHandle.getFile()
  return { mtimeMs: file.lastModified, size: file.size }
}

export async function createWebSyncAdapter(): Promise<SyncAdapter | null> {
  const handle = await getDirectorySyncHandle()
  if (!handle) return null

  return {
    async isConnected() {
      return ensureDirectoryPermission(handle, 'readwrite')
    },
    readSyncFile() {
      return readSyncFileFromHandle(handle)
    },
    writeSyncFile(content: string) {
      return writeSyncFileToHandle(handle, content)
    },
    getSyncFileMetadata() {
      return getSyncFileMetadataFromHandle(handle)
    },
  }
}

export async function getWebSyncFolderLabel(): Promise<string> {
  const handle = await getDirectorySyncHandle()
  return handle?.name ?? ''
}
