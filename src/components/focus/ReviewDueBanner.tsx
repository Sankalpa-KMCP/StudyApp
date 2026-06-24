import { AlertCircle } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'

interface ReviewDueBannerProps {
  count: number
  onViewQueue: () => void
}

export function ReviewDueBanner({ count, onViewQueue }: ReviewDueBannerProps) {
  const { t } = useTranslation()

  if (count <= 0) return null

  return (
    <div
      role="status"
      data-testid="review-due-banner"
      className="banner-accent mb-4 border border-card p-4"
      style={
        {
          '--banner-accent': 'var(--color-accent-amber)',
          backgroundColor: 'color-mix(in srgb, var(--color-accent-amber) 10%, transparent)',
          borderColor: 'color-mix(in srgb, var(--color-accent-amber) 25%, transparent)',
        } as React.CSSProperties
      }
    >
      <div className="flex items-start gap-3">
        <div className="banner-icon-well" style={{ '--banner-accent': 'var(--color-accent-amber)' } as React.CSSProperties}>
          <AlertCircle className="h-4 w-4 text-accent-amber" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-primary">
            {t('reviewDueBannerTitle', { count })}
          </p>
          <p className="text-caption settings-muted mt-1">{t('reviewDueBannerBody')}</p>
          <button
            type="button"
            onClick={onViewQueue}
            className="focus-ring mt-2 rounded-lg text-caption font-bold text-accent-amber hover:underline ios-active-scale"
          >
            {t('reviewDueBannerCta')}
          </button>
        </div>
      </div>
    </div>
  )
}
