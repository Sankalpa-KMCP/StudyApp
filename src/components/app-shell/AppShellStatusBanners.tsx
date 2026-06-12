import { useState } from 'react'
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
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
  const [expanded, setExpanded] = useState(false)

  if (isZenMode && !isOffline) return null

  const queue: BannerKey[] = []
  if (!isZenMode && quotaExceeded) queue.push('quota')
  if (isOffline) queue.push('offline')
  if (!isZenMode && showPwaBanner) queue.push('pwa')
  if (!isZenMode && showBackupReminder) queue.push('backup')

  if (queue.length === 0) return null

  const primary = queue[0]
  const secondary = queue.slice(1)
  const visibleKeys = expanded ? queue : [primary]

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
            className="flex items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-label font-semibold text-amber-200"
          >
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            You are offline — data stays on this device
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
      {visibleKeys.map(renderBanner)}
      {secondary.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex items-center justify-center gap-1 border-b border-white/5 bg-white/[0.03] px-4 py-1.5 text-micro font-semibold text-muted hover:text-primary transition-colors"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" aria-hidden />
              Hide alerts
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" aria-hidden />
              {secondary.length} more alert{secondary.length > 1 ? 's' : ''}
            </>
          )}
        </button>
      )}
    </div>
  )
}
