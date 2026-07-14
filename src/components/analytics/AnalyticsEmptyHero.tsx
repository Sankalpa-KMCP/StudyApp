import { BarChart3 } from 'lucide-react'
import { Button } from '../shared/Button'
import { useTranslation } from '../../i18n/useTranslation'

interface AnalyticsEmptyHeroProps {
  onStartFocus: () => void
}

export function AnalyticsEmptyHero({ onStartFocus }: AnalyticsEmptyHeroProps) {
  const { t } = useTranslation()

  return (
    <div
      role="status"
      className="relative overflow-hidden flex flex-col items-center justify-center text-center rounded-[var(--radius-panel)] border border-card surface-subtle py-12 px-6"
    >
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.08] pointer-events-none"
        aria-hidden
        preserveAspectRatio="none"
        viewBox="0 0 400 120"
      >
        {[40, 70, 55, 90, 45, 80, 60].map((h, i) => (
          <rect key={i} x={20 + i * 52} y={120 - h} width="32" height={h} rx="4" fill="var(--color-accent-blue)" />
        ))}
      </svg>
      <div className="relative z-10 flex flex-col items-center">
        <div className="text-muted opacity-60 mb-3">
          <BarChart3 className="h-8 w-8" />
        </div>
        <p className="text-caption font-semibold text-secondary">{t('analyticsEmptyTitle')}</p>
        <p className="text-label text-muted mt-1.5 max-w-sm">
          {t('analyticsEmptyDescription')}
        </p>
        <div className="mt-4">
          <Button variant="primary" onClick={onStartFocus}>
            {t('analyticsEmptyCta')}
          </Button>
        </div>
      </div>
    </div>
  )
}
