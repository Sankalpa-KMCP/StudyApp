import { useSettingsPanel } from './SettingsPanelContext'
import { useTranslation } from '../../i18n/useTranslation'
import { useStorageEstimate, formatBytes } from '../../hooks/useStorageEstimate'

export function StorageUsagePanel() {
  const { t } = useTranslation()
  const { historyRetentionDays } = useSettingsPanel()
  const { usageBytes, quotaBytes, rowCounts, isLoading, isSupported } = useStorageEstimate()

  const usageLabel =
    isSupported && usageBytes !== null && quotaBytes !== null
      ? t('storageUsageOf', { used: formatBytes(usageBytes), quota: formatBytes(quotaBytes) })
      : isSupported
        ? t('storageEstimating')
        : t('storageUnavailable')

  const rowLabels = {
    tasks: t('storageRowTasks'),
    history: t('storageRowHistory'),
    dailyLogs: t('storageRowDailyLogs'),
    notes: t('storageRowNotes'),
    categories: t('storageRowCategories'),
    snapshots: t('storageRowSnapshots'),
  } as const

  return (
    <div className="mb-5 rounded-2xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-accent-blue">{t('storageLocalStorage')}</p>
      <p className="text-[11px] settings-muted leading-relaxed">{isLoading ? t('storageLoading') : usageLabel}</p>
      {historyRetentionDays > 0 && (
        <p className="text-micro settings-muted">
          {t('storageHistoryRetention', { days: historyRetentionDays })}
        </p>
      )}
      {rowCounts && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-micro">
          {(
            [
              [rowLabels.tasks, rowCounts.tasks],
              [rowLabels.history, rowCounts.history],
              [rowLabels.dailyLogs, rowCounts.dailyLogs],
              [rowLabels.notes, rowCounts.quickNotes],
              [rowLabels.categories, rowCounts.categories],
              [rowLabels.snapshots, rowCounts.snapshots],
            ] as const
          ).map(([label, count]) => (
            <div key={label} className="rounded-lg surface-subtle px-2 py-1.5">
              <dt className="settings-muted">{label}</dt>
              <dd className="font-bold text-primary">{count}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
