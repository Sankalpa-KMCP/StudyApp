import { useState } from 'react'
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'
import { InstallPromptBanner } from '../InstallPromptBanner'
import { QuotaRecoveryBanner } from '../QuotaRecoveryBanner'
import { BackupReminderBanner } from '../BackupReminderBanner'

interface AppShellStatusBannersProps {
  isOffline: boolean
  isZenMode: boolean
  showPwaBanner: boolean
  quotaExceeded: boolean
  showBackupReminder: boolean
  backupDaysSinceExport?: number | null
  onPwaInstall: () => void
  onPwaDismiss: () => void
  onExportBackup: () => void
  onOpenRecovery: () => void
  onDismissQuota: () => void
  onDismissBackupReminder: () => void
}

type BannerKey = 'quota' | 'offline' | 'pwa' | 'backup'

export function AppShellStatusBanners({
  isOffline,
  isZenMode,
  showPwaBanner,
  quotaExceeded,
  showBackupReminder,
  backupDaysSinceExport,
  onPwaInstall,
  onPwaDismiss,
  onExportBackup,
  onOpenRecovery,
  onDismissQuota,
  onDismissBackupReminder,
}: AppShellStatusBannersProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  if (isZenMode && !isOffline) return null

  const prominent: BannerKey[] = []
  const collapsible: BannerKey[] = []

  if (isOffline) prominent.push('offline')
  if (!isZenMode && showPwaBanner) prominent.push('pwa')
  if (!isZenMode && quotaExceeded) collapsible.push('quota')
  if (!isZenMode && showBackupReminder) collapsible.push('backup')

  if (prominent.length === 0 && collapsible.length === 0) return null

  const visibleCollapsible = expanded ? collapsible : collapsible.slice(0, 1)
  const hiddenCollapsibleCount = expanded ? 0 : Math.max(0, collapsible.length - 1)

  const renderBanner = (key: BannerKey) => {
    switch (key) {
      case 'quota':
        return (
          <QuotaRecoveryBanner
            key="quota"
            onExport={onExportBackup}
            onOpenRecovery={onOpenRecovery}
            onDismiss={onDismissQuota}
          />
        )
      case 'offline':
        return (
          <div
            key="offline"
            role="status"
            className="status-banner-warning flex items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-label font-semibold"
          >
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            {t('offlineBanner')}
          </div>
        )
      case 'pwa':
        return (
          <InstallPromptBanner key="pwa" onInstall={onPwaInstall} onDismiss={onPwaDismiss} />
        )
      case 'backup':
        return (
          <BackupReminderBanner
            key="backup"
            onExport={onExportBackup}
            onDismiss={onDismissBackupReminder}
            daysSinceExport={backupDaysSinceExport}
          />
        )
    }
  }

  return (
    <div className="flex flex-col">
      {prominent.map(renderBanner)}
      {visibleCollapsible.map(renderBanner)}
      {hiddenCollapsibleCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center justify-center gap-1 border-b border-card surface-subtle px-4 py-1.5 text-micro font-semibold text-muted hover:text-primary transition-colors"
          aria-expanded={expanded}
        >
          <ChevronDown className="h-3 w-3" aria-hidden />
          {hiddenCollapsibleCount} more alert{hiddenCollapsibleCount > 1 ? 's' : ''}
        </button>
      )}
      {expanded && collapsible.length > 1 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="flex items-center justify-center gap-1 border-b border-card surface-subtle px-4 py-1.5 text-micro font-semibold text-muted hover:text-primary transition-colors"
          aria-expanded={expanded}
        >
          <ChevronUp className="h-3 w-3" aria-hidden />
          Hide alerts
        </button>
      )}
    </div>
  )
}
