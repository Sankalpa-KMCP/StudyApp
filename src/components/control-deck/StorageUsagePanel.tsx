import { useSettingsPanel } from './SettingsPanelContext'
import { useStorageEstimate, formatBytes } from '../../hooks/useStorageEstimate'

export function StorageUsagePanel() {
  const { historyRetentionDays } = useSettingsPanel()
  const { usageBytes, quotaBytes, rowCounts, isLoading, isSupported } = useStorageEstimate()

  const usageLabel =
    isSupported && usageBytes !== null && quotaBytes !== null
      ? `${formatBytes(usageBytes)} of ${formatBytes(quotaBytes)} used`
      : isSupported
        ? 'Estimating storage…'
        : 'Storage estimate unavailable in this browser'

  return (
    <div className="mb-5 rounded-2xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-accent-blue">Local storage</p>
      <p className="text-[11px] settings-muted leading-relaxed">{isLoading ? 'Loading…' : usageLabel}</p>
      {historyRetentionDays > 0 && (
        <p className="text-micro settings-muted">
          History retention: {historyRetentionDays} days (configure in Timer &amp; Focus)
        </p>
      )}
      {rowCounts && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-micro">
          {(
            [
              ['Tasks', rowCounts.tasks],
              ['History', rowCounts.history],
              ['Daily logs', rowCounts.dailyLogs],
              ['Flashcards', rowCounts.flashcards],
              ['Notes', rowCounts.quickNotes],
              ['Categories', rowCounts.categories],
              ['Snapshots', rowCounts.snapshots],
            ] as const
          ).map(([label, count]) => (
            <div key={label} className="rounded-lg bg-white/[0.03] px-2 py-1.5">
              <dt className="settings-muted">{label}</dt>
              <dd className="font-bold text-primary">{count}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
