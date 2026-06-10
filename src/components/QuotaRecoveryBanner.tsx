import { AlertCircle } from 'lucide-react'
import { Button } from './shared/Button'

interface QuotaRecoveryBannerProps {
  onExport: () => void
  onOpenRecovery: () => void
  onDismiss: () => void
}

export function QuotaRecoveryBanner({ onExport, onOpenRecovery, onDismiss }: QuotaRecoveryBannerProps) {
  return (
    <div
      role="alert"
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/25 bg-amber-500/10 px-4 py-3"
    >
      <div className="flex items-start sm:items-center gap-2.5">
        <AlertCircle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5 sm:mt-0" aria-hidden />
        <p className="text-label font-semibold text-amber-100 leading-relaxed">
          Storage full — export your data, then free space in Settings.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Button variant="primary" size="sm" onClick={onExport}>
          Export now
        </Button>
        <Button variant="secondary" size="sm" onClick={onOpenRecovery}>
          Open recovery
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}
