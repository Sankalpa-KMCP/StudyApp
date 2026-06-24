import { Sparkles, X } from 'lucide-react'
import { useTranslation } from '../i18n/useTranslation'

interface InstallPromptBannerProps {
  onInstall: () => void
  onDismiss: () => void
}

export function InstallPromptBanner({ onInstall, onDismiss }: InstallPromptBannerProps) {
  const { t } = useTranslation()

  return (
    <div
      role="region"
      aria-label={t('bannerInstallAria')}
      className="banner-accent flex items-center justify-between gap-3 border-b border-card px-4 py-2.5"
      style={
        {
          '--banner-accent': 'var(--color-accent-blue)',
          backgroundColor: 'color-mix(in srgb, var(--color-accent-blue) 10%, transparent)',
          borderColor: 'color-mix(in srgb, var(--color-accent-blue) 25%, transparent)',
        } as React.CSSProperties
      }
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="banner-icon-well" style={{ '--banner-accent': 'var(--color-accent-blue)' } as React.CSSProperties}>
          <Sparkles className="h-4 w-4 text-accent-blue" aria-hidden />
        </div>
        <p className="text-label font-semibold text-primary truncate">{t('bannerInstallMessage')}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onInstall}
          className="focus-ring rounded-full bg-accent-blue px-3 py-1 text-label font-bold text-on-accent ios-active-scale"
        >
          {t('commonInstall')}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('bannerInstallDismiss')}
          className="focus-ring chrome-icon-btn chrome-icon-btn--sm rounded-full text-muted hover:text-primary ios-active-scale"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
