import { AlertCircle } from 'lucide-react'
import { InstallPromptBanner } from '../InstallPromptBanner'
import { QuotaRecoveryBanner } from '../QuotaRecoveryBanner'

interface AppShellStatusBannersProps {
  isOffline: boolean
  isZenMode: boolean
  showPwaBanner: boolean
  quotaExceeded: boolean
  onPwaInstall: () => void
  onPwaDismiss: () => void
  onExportBackup: () => void
  onOpenRecovery: () => void
  onDismissQuota: () => void
}

export function AppShellStatusBanners({
  isOffline,
  isZenMode,
  showPwaBanner,
  quotaExceeded,
  onPwaInstall,
  onPwaDismiss,
  onExportBackup,
  onOpenRecovery,
  onDismissQuota,
}: AppShellStatusBannersProps) {
  if (isZenMode && !isOffline) return null

  return (
    <>
      {isOffline && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-label font-semibold text-amber-200"
        >
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          You are offline — data stays on this device
        </div>
      )}
      {!isZenMode && showPwaBanner && (
        <InstallPromptBanner onInstall={onPwaInstall} onDismiss={onPwaDismiss} />
      )}
      {!isZenMode && quotaExceeded && (
        <QuotaRecoveryBanner
          onExport={onExportBackup}
          onOpenRecovery={onOpenRecovery}
          onDismiss={onDismissQuota}
        />
      )}
    </>
  )
}
