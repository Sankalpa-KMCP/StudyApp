import { useRef } from 'react'
import { canShareStudyBackup } from '../lib/backup/backupShare'
import { useBackupSnapshots } from './backup/useBackupSnapshots'
import { useBackupVaultExport } from './backup/useBackupVaultExport'
import { useBackupVaultImport } from './backup/useBackupVaultImport'
import { useBackupIcs } from './backup/useBackupIcs'
import { useBackupReset } from './backup/useBackupReset'

export type {
  StudyBackupExportDestination,
  StudyBackupExportOptions,
  StudyBackupImportMode,
  StudyBackupImportOptions,
} from './backup/types'

export function useSessionBackup(pushToast: (key: string, message: string) => void) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const snapshots = useBackupSnapshots(pushToast)
  const vaultExport = useBackupVaultExport(pushToast)
  const vaultImport = useBackupVaultImport(pushToast)
  const ics = useBackupIcs(pushToast)
  const reset = useBackupReset(pushToast)

  return {
    fileInputRef,
    isExporting: vaultExport.isExporting,
    exportProgress: vaultExport.exportProgress,
    createDatabaseSnapshot: snapshots.createDatabaseSnapshot,
    exportStudyBackup: vaultExport.exportStudyBackup,
    shareStudyBackupVault: vaultExport.shareStudyBackupVault,
    exportStudyHistoryIcs: ics.exportStudyHistoryIcs,
    canShareBackup: canShareStudyBackup(),
    clearSnapshots: snapshots.clearSnapshots,
    exportStudyLogsCSV: ics.exportStudyLogsCSV,
    exportTaskCompletionLogsCSV: ics.exportTaskCompletionLogsCSV,
    importStudyBackup: vaultImport.importStudyBackup,
    importStudyHistoryIcs: ics.importStudyHistoryIcs,
    resetData: reset.resetData,
    resetDataSelective: reset.resetDataSelective,
  }
}

export type SessionBackupApi = ReturnType<typeof useSessionBackup>
