import { X } from 'lucide-react'
import { useTranslation } from '../i18n/useTranslation'

interface BackupReminderBannerProps {
  onExport: () => void
  onDismiss: () => void
  daysSinceExport?: number | null
}

export function BackupReminderBanner({ onExport, onDismiss, daysSinceExport }: BackupReminderBannerProps) {
  const { t } = useTranslation()

  const message =
    daysSinceExport === null || daysSinceExport === undefined
      ? t('bannerBackupExportDefault')
      : daysSinceExport === 0
        ? t('bannerBackupExportToday')
        : t('bannerBackupExportDaysAgo', { days: daysSinceExport })

  return (
    <div
      role="region"
      aria-label={t('bannerBackupReminderAria')}
      className="banner-accent flex items-center justify-between gap-3 border-b border-card px-4 py-2.5"
      style={
        {
          '--banner-accent': 'var(--color-accent-amber)',
          backgroundColor: 'color-mix(in srgb, var(--color-accent-amber) 10%, transparent)',
          borderColor: 'color-mix(in srgb, var(--color-accent-amber) 25%, transparent)',
        } as React.CSSProperties
      }
    >
      <p className="text-label font-semibold text-primary truncate min-w-0">{message}</p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onExport}
          className="focus-ring rounded-full bg-accent-amber px-3 py-1 text-label font-bold text-on-accent ios-active-scale"
        >
          {t('commonExport')}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('bannerBackupDismiss')}
          className="focus-ring chrome-icon-btn chrome-icon-btn--sm rounded-full text-muted hover:text-primary ios-active-scale"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
