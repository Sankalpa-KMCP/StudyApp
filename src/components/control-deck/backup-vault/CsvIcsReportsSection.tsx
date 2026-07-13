import { Button } from '../../shared/Button'
import { useTranslation } from '../../../i18n/useTranslation'
import { archiveHistoryOlderThan } from '../../../db/repositories/history'
import { backupArchiveHistoryResult } from '../../../lib/backup/backupTerms'

interface CsvIcsReportsSectionProps {
  historyRetentionDays: number
  exportStudyLogsCSV: () => void
  exportStudyHistoryIcs?: () => void
  exportTaskCompletionLogsCSV: () => void
  importStudyHistoryIcs?: (fileString: string) => void
  pushToast: (key: string, message: string) => void
  onArchiveComplete: () => void
  requestConfirm: (options: {
    title: string
    message: string
    confirmLabel?: string
    danger?: boolean
  }) => Promise<boolean>
}

export function CsvIcsReportsSection({
  historyRetentionDays,
  exportStudyLogsCSV,
  exportStudyHistoryIcs,
  exportTaskCompletionLogsCSV,
  importStudyHistoryIcs,
  pushToast,
  onArchiveComplete,
  requestConfirm,
}: CsvIcsReportsSectionProps) {
  const { t } = useTranslation()

  return (
    <div className="border-t border-[var(--color-border-card)] pt-5">
      <span className="settings-label block mb-3">{t('backupVaultCsvReportsExport')}</span>
      {historyRetentionDays > 0 && (
        <div className="mb-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              const ok = await requestConfirm({
                title: t('backupVaultArchiveHistoryConfirmTitle', { days: historyRetentionDays }),
                message: t('backupVaultArchiveHistoryConfirmMessage'),
                confirmLabel: t('backupVaultArchiveHistoryConfirmLabel'),
                danger: true,
              })
              if (!ok) return
              const deleted = await archiveHistoryOlderThan(historyRetentionDays)
              onArchiveComplete()
              pushToast('ARCHIVE', backupArchiveHistoryResult(deleted))
            }}
          >
            {t('backupVaultArchiveOldHistory', { days: historyRetentionDays })}
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] p-4 flex flex-col justify-between">
          <div>
            <span className="settings-label block">{t('backupVaultStudyLogsCsv')}</span>
            <span className="settings-muted mt-1 leading-normal font-semibold block">{t('backupVaultStudyLogsCsvDesc')}</span>
          </div>
          <button
            onClick={exportStudyLogsCSV}
            className="w-full mt-4 rounded-full bg-accent-blue/10 hover:bg-accent-blue/25 text-accent-blue border border-accent-blue/20 py-2.5 text-xs font-bold transition-all ios-active-scale cursor-pointer"
          >
            {t('backupVaultExportCsvLogs')}
          </button>
          <button
            onClick={() => exportStudyHistoryIcs?.()}
            className="w-full mt-4 rounded-full bg-accent-green/10 hover:bg-accent-green/25 text-accent-green border border-accent-green/20 py-2.5 text-xs font-bold transition-all ios-active-scale cursor-pointer"
          >
            {t('backupVaultExportIcsCalendar')}
          </button>
          <label className="w-full mt-2 block">
            <span className="sr-only">{t('backupVaultImportIcsAria')}</span>
            <input
              type="file"
              accept=".ics,text/calendar"
              className="text-micro settings-muted w-full"
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = () => {
                  if (typeof reader.result === 'string') importStudyHistoryIcs?.(reader.result)
                }
                reader.readAsText(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <div className="rounded-2xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] p-4 flex flex-col justify-between">
          <div>
            <span className="settings-label block">{t('backupVaultTaskCompletionCsv')}</span>
            <span className="settings-muted mt-1 leading-normal font-semibold block">{t('backupVaultTaskCompletionCsvDesc')}</span>
          </div>
          <button
            onClick={exportTaskCompletionLogsCSV}
            className="w-full mt-4 rounded-full bg-accent-blue/10 hover:bg-accent-blue/25 text-accent-blue border border-accent-blue/20 py-2.5 text-xs font-bold transition-all ios-active-scale cursor-pointer"
          >
            {t('backupVaultExportCsvTasks')}
          </button>
        </div>
      </div>
    </div>
  )
}
