import { useState } from 'react'
import { collectStudyBackupPayload, downloadStudyBackup } from '../../lib/backup/backupExport'
import { encryptBackupPayload } from '../../lib/backup/backupCrypto'
import { writeBackupToDesktopFolder } from '../../lib/desktop/tauri'
import { setLastBackupExportAt } from '../../lib/backup/backupMetadata'
import { shareStudyBackup } from '../../lib/backup/backupShare'
import { backupExportComplete, backupExportFailed } from '../../lib/backup/backupTerms'
import { resolveExportDestination, resolveSyncFolder } from './backupExportHelpers'
import type { PushToast, StudyBackupExportOptions } from './types'

export function useBackupVaultExport(pushToast: PushToast) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  async function exportStudyBackup(options?: StudyBackupExportOptions) {
    try {
      setIsExporting(true)
      setExportProgress(0)
      const payload = await collectStudyBackupPayload(setExportProgress)
      const folder = await resolveSyncFolder()
      const destination = resolveExportDestination(options?.destination ?? 'download', folder)

      let exportBody: unknown = payload
      if (options?.encrypt && options.passphrase) {
        exportBody = await encryptBackupPayload(payload, options.passphrase, payload.checksumSha256 ?? '')
      }

      if (destination === 'download') {
        if (options?.encrypt && options.passphrase) {
          const blob = new Blob([JSON.stringify(exportBody, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `study-vault-${new Date().toISOString().slice(0, 10)}.studybackup`
          a.click()
          URL.revokeObjectURL(url)
        } else {
          downloadStudyBackup(payload, 'study-vault')
        }
      } else if (folder) {
        await writeBackupToDesktopFolder(folder, exportBody as typeof payload)
      }

      setLastBackupExportAt()
      pushToast('BACKUP', backupExportComplete())
    } catch (err) {
      console.error('Export failed:', err)
      pushToast('BACKUP', backupExportFailed())
    } finally {
      setIsExporting(false)
      setExportProgress(0)
    }
  }

  async function shareStudyBackupVault() {
    try {
      setIsExporting(true)
      setExportProgress(0)
      const payload = await collectStudyBackupPayload(setExportProgress)
      const shared = await shareStudyBackup(payload, 'study-vault')
      if (!shared) {
        downloadStudyBackup(payload, 'study-vault')
      }
      setLastBackupExportAt()
      pushToast('BACKUP', backupExportComplete())
    } catch (err) {
      console.error('Share failed:', err)
      pushToast('BACKUP', backupExportFailed())
    } finally {
      setIsExporting(false)
      setExportProgress(0)
    }
  }

  return { isExporting, exportProgress, exportStudyBackup, shareStudyBackupVault }
}
