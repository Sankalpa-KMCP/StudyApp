import { getSetting } from '../../db/repositories/settings'
import { isTauri } from '../../lib/desktop/tauri'
import type { StudyBackupExportDestination } from './types'

export async function resolveSyncFolder(): Promise<string> {
  if (!isTauri()) return ''
  const syncPath = await getSetting('syncFolderPath')
  if (typeof syncPath === 'string' && syncPath) return syncPath
  const legacyPath = await getSetting('desktopBackupFolderPath')
  return typeof legacyPath === 'string' ? legacyPath : ''
}

export function resolveExportDestination(
  requested: StudyBackupExportDestination,
  folderPath: string,
): 'download' | 'folder' {
  if (requested === 'download') return 'download'
  if (requested === 'folder') return folderPath ? 'folder' : 'download'
  return isTauri() && folderPath ? 'folder' : 'download'
}
