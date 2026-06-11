import { X } from 'lucide-react'

interface BackupReminderBannerProps {
  onExport: () => void
  onDismiss: () => void
  daysSinceExport?: number | null
}

export function BackupReminderBanner({ onExport, onDismiss, daysSinceExport }: BackupReminderBannerProps) {
  const message =
    daysSinceExport === null || daysSinceExport === undefined
      ? 'Back up your study data — export your vault'
      : daysSinceExport === 0
        ? 'Consider exporting your vault — last backup was today'
        : `Back up your study data — last export was ${daysSinceExport} day${daysSinceExport === 1 ? '' : 's'} ago`

  return (
    <div
      role="region"
      aria-label="Backup reminder"
      className="flex items-center justify-between gap-3 border-b border-accent-amber/20 bg-accent-amber/10 px-4 py-2.5"
    >
      <p className="text-label font-semibold text-white/90 truncate min-w-0">{message}</p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onExport}
          className="rounded-full bg-accent-amber px-3 py-1 text-label font-bold text-white ios-active-scale"
        >
          Export
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss backup reminder"
          className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 ios-active-scale"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
