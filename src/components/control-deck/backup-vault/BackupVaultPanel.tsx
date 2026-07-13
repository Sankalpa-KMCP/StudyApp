import { useConfirm } from '../../../context/useConfirm'
import { useTranslation } from '../../../i18n/useTranslation'
import { useSettingsPanel } from '../SettingsPanelContext'
import { SettingsCard } from '../../shared/settings/SettingsCard'
import { SettingsDisclosure } from '../../shared/settings/SettingsDisclosure'
import { StorageUsagePanel } from '../StorageUsagePanel'
import { FolderSyncPanel } from '../FolderSyncPanel'
import { daysSinceLastExport } from '../../../lib/backup/backupMetadata'
import { StorageRecoveryBanner } from './StorageRecoveryBanner'
import { BackupExportImportSection } from './BackupExportImportSection'
import { ScheduledExportSection } from './ScheduledExportSection'
import { EncryptedExportSection } from './EncryptedExportSection'
import { CsvIcsReportsSection } from './CsvIcsReportsSection'
import { BackupResetSection } from './BackupResetSection'
import { useBackupVaultPanelState } from './useBackupVaultPanelState'

export function BackupVaultPanel() {
  const { t } = useTranslation()
  const {
    backup,
    quotaExceeded,
    historyRetentionDays,
    autoExportEnabled,
    autoExportIntervalDays,
    syncFolderPath,
    updateSetting,
    pushToast,
    isDragging,
    setIsDragging,
    handleFileDrop,
  } = useSettingsPanel()
  const {
    exportStudyBackup,
    shareStudyBackupVault,
    exportStudyHistoryIcs,
    canShareBackup = false,
    isExporting = false,
    exportProgress = 0,
    exportStudyLogsCSV,
    exportTaskCompletionLogsCSV,
    importStudyBackup,
    importStudyHistoryIcs,
    resetData,
    resetDataSelective,
    clearSnapshots,
    fileInputRef,
  } = backup
  const { requestConfirm } = useConfirm()
  const panelState = useBackupVaultPanelState()

  const daysSince = daysSinceLastExport()
  const lastExportNote = daysSince === null
    ? t('backupVaultNoExportRecorded')
    : t('backupVaultLastExportDays', { days: Math.floor(daysSince) })

  return (
    <SettingsCard id="settings-backup-vault" title={t('backupVaultPanelTitle')}>
      <StorageUsagePanel key={panelState.storageKey} />

      {quotaExceeded && (
        <StorageRecoveryBanner
          exportStudyBackup={exportStudyBackup}
          clearSnapshots={clearSnapshots}
          resetDataSelective={resetDataSelective}
          requestConfirm={requestConfirm}
        />
      )}

      <p className="settings-muted mb-5 leading-relaxed">
        {t('backupVaultDescription')}
      </p>

      <FolderSyncPanel />

      <BackupExportImportSection
        syncFolderPath={syncFolderPath}
        lastExportNote={lastExportNote}
        isExporting={isExporting}
        exportProgress={exportProgress}
        exportStudyBackup={exportStudyBackup}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        handleFileDrop={handleFileDrop}
        fileInputRef={fileInputRef}
        importMode={panelState.importMode}
        setImportMode={panelState.setImportMode}
        importPassphrase={panelState.importPassphrase}
        setImportPassphrase={panelState.setImportPassphrase}
        prepareImportSession={panelState.prepareImportSession}
      />

      <div className="mt-5">
        <SettingsDisclosure title={t('backupVaultAdvancedTools')} defaultOpen={false}>
          <ScheduledExportSection
            autoExportEnabled={autoExportEnabled}
            autoExportIntervalDays={autoExportIntervalDays}
            syncFolderPath={syncFolderPath}
            updateSetting={updateSetting}
          />

          <EncryptedExportSection
            encryptPassphrase={panelState.encryptPassphrase}
            setEncryptPassphrase={panelState.setEncryptPassphrase}
            exportStudyBackup={exportStudyBackup}
            shareStudyBackupVault={shareStudyBackupVault}
            canShareBackup={canShareBackup}
            isExporting={isExporting}
          />

          <CsvIcsReportsSection
            historyRetentionDays={historyRetentionDays}
            exportStudyLogsCSV={exportStudyLogsCSV}
            exportStudyHistoryIcs={exportStudyHistoryIcs}
            exportTaskCompletionLogsCSV={exportTaskCompletionLogsCSV}
            importStudyHistoryIcs={importStudyHistoryIcs}
            pushToast={pushToast}
            onArchiveComplete={panelState.bumpStorageKey}
            requestConfirm={requestConfirm}
          />

          <BackupResetSection
            sweepTasks={panelState.sweepTasks}
            setSweepTasks={panelState.setSweepTasks}
            sweepHistory={panelState.sweepHistory}
            setSweepHistory={panelState.setSweepHistory}
            sweepCategories={panelState.sweepCategories}
            setSweepCategories={panelState.setSweepCategories}
            sweepNotes={panelState.sweepNotes}
            setSweepNotes={panelState.setSweepNotes}
            resetDataSelective={resetDataSelective}
            resetData={resetData}
            resetSweepFlags={panelState.resetSweepFlags}
            requestConfirm={requestConfirm}
          />
        </SettingsDisclosure>
      </div>

      <input
        type="file"
        accept=".studybackup,.json"
        ref={fileInputRef}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) {
            const r = new FileReader()
            r.onload = () => importStudyBackup(r.result as string)
            r.readAsText(file)
          }
          e.target.value = ''
        }}
      />
    </SettingsCard>
  )
}
