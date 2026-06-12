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
      className="mb-4 rounded-2xl border border-accent-blue/25 bg-accent-blue/10 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 shrink-0 text-accent-blue mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-bold text-[var(--color-text-primary)]">{t('firstSessionTitle')}</p>
            <p className="text-caption settings-muted mt-1">{t('firstSessionStep1')}</p>
            <p className="text-caption settings-muted mt-0.5">{t('firstSessionStep2')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-full p-1.5 text-muted hover:text-primary hover:bg-white/5 transition-colors ios-active-scale"
          aria-label={t('firstSessionDismiss')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
