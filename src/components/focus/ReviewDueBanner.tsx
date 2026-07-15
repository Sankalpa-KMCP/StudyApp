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
      className="mb-4 rounded-2xl border border-accent-amber/25 bg-accent-amber/10 p-4"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-accent-amber mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[var(--color-text-primary)]">
            {t('reviewDueBannerTitle', { count })}
          </p>
          <p className="text-caption settings-muted mt-1">{t('reviewDueBannerBody')}</p>
          <button
            type="button"
            onClick={onViewQueue}
            className="mt-2 text-caption font-bold text-accent-amber hover:underline ios-active-scale"
          >
            {t('reviewDueBannerCta')}
          </button>
        </div>
      </div>
    </div>
  )
}
