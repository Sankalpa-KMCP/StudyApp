import { AlertCircle, X } from 'lucide-react'
import { Button } from './shared/Button'
import { useTranslation } from '../i18n/useTranslation'

interface QuotaRecoveryBannerProps {
  onExport: () => void
  onOpenRecovery: () => void
  onDismiss: () => void
}

export function QuotaRecoveryBanner({ onExport, onOpenRecovery, onDismiss }: QuotaRecoveryBannerProps) {
  const { t } = useTranslation()

  return (
    <div
      role="alert"
      className="banner-accent flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-card px-4 py-3"
      style={
        {
          '--banner-accent': 'var(--color-accent-amber)',
          backgroundColor: 'color-mix(in srgb, var(--color-accent-amber) 12%, transparent)',
          borderColor: 'color-mix(in srgb, var(--color-accent-amber) 28%, transparent)',
        } as React.CSSProperties
      }
    >
      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
        <div className="banner-icon-well" style={{ '--banner-accent': 'var(--color-accent-amber)' } as React.CSSProperties}>
          <AlertCircle className="h-4 w-4 text-accent-amber" aria-hidden />
        </div>
        <p className="text-label font-semibold text-primary leading-relaxed">
          {t('bannerQuotaMessage')}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Button variant="primary" size="sm" onClick={onExport} className="focus-ring">
          {t('bannerQuotaExportNow')}
        </Button>
        <Button variant="secondary" size="sm" onClick={onOpenRecovery} className="focus-ring">
          {t('bannerQuotaOpenRecovery')}
        </Button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('commonDismiss')}
          className="focus-ring chrome-icon-btn chrome-icon-btn--sm rounded-full text-muted hover:text-primary ios-active-scale"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
