import { db } from '../db'
import type { SyncHandleRow } from '../types'

const DIRECTORY_KIND = 'directory' as const

export async function getDirectorySyncHandle(): Promise<FileSystemDirectoryHandle | null> {
  const row = await db.sync_handles.where('kind').equals(DIRECTORY_KIND).first()
  return row?.handle ?? null
}

export async function saveDirectorySyncHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await db.sync_handles.where('kind').equals(DIRECTORY_KIND).delete()
  await db.sync_handles.add({ kind: DIRECTORY_KIND, handle } satisfies SyncHandleRow)
}

export async function clearDirectorySyncHandle(): Promise<void> {
  await db.sync_handles.where('kind').equals(DIRECTORY_KIND).delete()
}
