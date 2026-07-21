import { Sparkles, X } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'

interface FirstSessionBannerProps {
  onDismiss: () => void
}

export function FirstSessionBanner({ onDismiss }: FirstSessionBannerProps) {
  const { t } = useTranslation()

  return (
    <div
      role="status"
      data-testid="first-session-banner"
      className="banner-accent mb-4 border border-card p-4"
      style={
        {
          '--banner-accent': 'var(--color-accent-blue)',
          backgroundColor: 'color-mix(in srgb, var(--color-accent-blue) 10%, transparent)',
          borderColor: 'color-mix(in srgb, var(--color-accent-blue) 25%, transparent)',
        } as React.CSSProperties
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="banner-icon-well" style={{ '--banner-accent': 'var(--color-accent-blue)' } as React.CSSProperties}>
            <Sparkles className="h-4 w-4 text-accent-blue" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-bold text-primary">{t('firstSessionTitle')}</p>
            <p className="text-caption settings-muted mt-1">{t('firstSessionStep1')}</p>
            <p className="text-caption settings-muted mt-0.5">{t('firstSessionStep2')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="focus-ring shrink-0 rounded-full p-1.5 text-muted hover:text-primary hover:surface-subtle transition-colors ios-active-scale"
          aria-label={t('firstSessionDismiss')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
