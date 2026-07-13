import { mergeBackupData, replaceAllTables } from '../../db/repositories/database'
import { decryptBackupEnvelope, isEncryptedBackupEnvelope } from '../../lib/backup/backupCrypto'
import { verifyBackupChecksum } from '../../lib/backup/backupChecksum'
import { parseStudyBackupPayload, validateBackupPayload, backupPayloadToTables } from '../../lib/study/studyDashboard'
import { devLog } from '../../lib/shared/devLogger'
import {
  backupImportChecksumFailed,
  backupImportFailed,
  backupImportInvalid,
  backupImportInvalidFormat,
  backupImportInvalidSchema,
  backupLegacyFlashcardsSkipped,
  backupMergedSuccessfully,
  backupPassphraseRequired,
} from '../../lib/backup/backupTerms'
import type { PushToast, StudyBackupImportOptions } from './types'

export function useBackupVaultImport(pushToast: PushToast) {
  async function importStudyBackup(fileString: string, options?: StudyBackupImportOptions) {
    try {
      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(fileString)
      } catch {
        pushToast('BACKUP', backupImportInvalidFormat())
        return
      }

      if (isEncryptedBackupEnvelope(parsedJson)) {
        if (!options?.passphrase) {
          pushToast('BACKUP', backupPassphraseRequired())
          return
        }
        const decrypted = await decryptBackupEnvelope(parsedJson, options.passphrase)
        parsedJson = decrypted
        fileString = JSON.stringify(decrypted)
      }

      if (!validateBackupPayload(parsedJson)) {
        pushToast('BACKUP', backupImportInvalidSchema())
        return
      }

      const data = parseStudyBackupPayload(fileString)
      if (!data) {
        pushToast('BACKUP', backupImportInvalid())
        return
      }

      const checksumValid = await verifyBackupChecksum(data)
      if (!checksumValid) {
        pushToast('BACKUP', backupImportChecksumFailed())
        return
      }

      if (options?.mode === 'merge') {
        await mergeBackupData(backupPayloadToTables(data))
        if (data._legacyFlashcards?.length) {
          pushToast('BACKUP', backupLegacyFlashcardsSkipped())
        }
        pushToast('BACKUP', backupMergedSuccessfully())
        devLog('backup', 'merge-success', { tasks: data.tasks.length, history: data.history.length })
        return
      }

      await replaceAllTables(backupPayloadToTables(data))

      if (data._legacyFlashcards?.length) {
        pushToast('BACKUP', backupLegacyFlashcardsSkipped())
      }

      localStorage.removeItem('study_dashboard_snapshots')
      localStorage.removeItem('completed_study_sessions_count')
      devLog('backup', 'import-success', { tasks: data.tasks.length, history: data.history.length })
      window.location.reload()
    } catch (err) {
      console.error('Failed to import vault:', err)
      pushToast('BACKUP', backupImportFailed())
    }
  }

  return { importStudyBackup }
}
