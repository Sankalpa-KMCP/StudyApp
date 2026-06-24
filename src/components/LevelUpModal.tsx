import { useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { ModalShell } from './shared/ModalShell'
import { Button } from './shared/Button'
import { useTranslation } from '../i18n/useTranslation'

interface LevelUpModalProps {
  level: number
  xpProgressPercent: number
  onDismiss: () => void
}

export function LevelUpModal({ level, xpProgressPercent, onDismiss }: LevelUpModalProps) {
  const { t } = useTranslation()

  useEffect(() => {
    const delayBurst = (delayMs: number, count: number) => {
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('celebrate-complete', {
            detail: {
              count,
              x: Math.random() * window.innerWidth,
              y: window.innerHeight * 0.7,
            },
          }),
        )
      }, delayMs)
    }
    delayBurst(100, 80)
    delayBurst(400, 50)
    delayBurst(700, 50)
  }, [])

  return (
    <ModalShell
      open
      onClose={onDismiss}
      ariaLabelledby="level-up-title"
      panelClassName="max-w-sm surface-subtle p-6 text-center"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-accent-amber/15 border border-accent-amber/30 flex items-center justify-center">
          <Sparkles className="h-7 w-7 text-accent-amber" aria-hidden />
        </div>
        <div>
          <p className="text-label font-bold uppercase tracking-widest text-muted mb-1">{t('levelUpTitle')}</p>
          <h2 id="level-up-title" className="text-3xl font-extrabold text-primary">{t('levelUpHeading', { level })}</h2>
          <p className="text-caption text-muted mt-2">{t('levelUpBody')}</p>
        </div>
        <div className="w-full">
          <div className="flex justify-between text-micro font-mono text-muted mb-1.5">
            <span>{t('levelUpXpProgress')}</span>
            <span>{Math.round(xpProgressPercent)}%</span>
          </div>
          <div className="h-2 w-full rounded-full surface-track border border-card overflow-hidden">
            <div
              className="h-full bg-accent-amber transition-all duration-500"
              style={{ width: `${xpProgressPercent}%` }}
              role="progressbar"
              aria-valuenow={Math.round(xpProgressPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
        <Button variant="primary" onClick={onDismiss} className="focus-ring w-full">
          {t('levelUpKeepFocusing')}
        </Button>
      </div>
    </ModalShell>
  )
}
