import { Play, Pause, Check } from 'lucide-react'
import { Button } from '../shared/Button'
import { useTranslation } from '../../i18n/useTranslation'
import { SessionProgress } from './SessionProgress'

interface TimerControlsProps {
  timerMode: 'study' | 'break'
  isTimerActive: boolean
  secondsElapsed: number
  activeColor: string
  completedSessionsInCycle: number
  targetSessionsPerCycle: number
  onToggleActive: () => void
  onExtend: () => void
  onComplete: () => void
  onSkipBreak?: () => void
  skipBreak: () => void
}

export function TimerControls({
  timerMode,
  isTimerActive,
  secondsElapsed,
  activeColor,
  completedSessionsInCycle,
  targetSessionsPerCycle,
  onToggleActive,
  onExtend,
  onComplete,
  onSkipBreak,
  skipBreak,
}: TimerControlsProps) {
  const { t } = useTranslation()
  const playPauseLabel = isTimerActive ? t('pauseTimer') : t('startTimer')
  const focusCtaLabel = isTimerActive ? t('pauseFocus') : t('startFocus')

  return (
    <div className="flex flex-col items-center gap-3 mt-5 select-none w-full max-w-xs">
      <div className="flex items-center gap-3 flex-wrap justify-center w-full">
        {timerMode === 'break' && (
          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={onSkipBreak ?? skipBreak}
            aria-label={t('timerSkipBreakAria')}
            className="focus-ring !rounded-full"
          >
            {t('endBreakEarly')}
          </Button>
        )}

        <div className="flex flex-col items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onToggleActive}
            aria-label={playPauseLabel}
            className={`focus-ring hidden md:flex h-14 w-14 !p-0 items-center justify-center rounded-full !border-0 ${!isTimerActive ? 'timer-cta-idle' : ''}`}
            style={{ backgroundColor: activeColor, ['--timer-cta-color' as string]: activeColor }}
          >
            {isTimerActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onToggleActive}
            aria-label={playPauseLabel}
            data-testid="mobile-timer-play-pause"
            className={`focus-ring md:hidden h-12 w-12 !p-0 items-center justify-center rounded-full !border-0 ${!isTimerActive ? 'timer-cta-idle' : ''}`}
            style={{ backgroundColor: activeColor, ['--timer-cta-color' as string]: activeColor }}
          >
            {isTimerActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </Button>

          <SessionProgress
            completedSessionsInCycle={completedSessionsInCycle}
            targetSessionsPerCycle={targetSessionsPerCycle}
          />
        </div>

        {(isTimerActive || secondsElapsed > 0) && (
          <>
            <button
              type="button"
              onClick={onExtend}
              aria-label={t('timerExtendFiveMinAria')}
              className="focus-ring hidden md:inline-flex px-4 py-2.5 rounded-full text-xs font-bold border border-accent-purple/20 bg-accent-purple/10 hover:bg-accent-purple/20 text-accent-purple transition-all ios-active-scale cursor-pointer"
            >
              {t('extendFiveMin')}
            </button>
            <button
              type="button"
              onClick={onComplete}
              aria-label={t('timerCompleteSessionAria')}
              className="focus-ring hidden md:flex items-center gap-1.5 rounded-full surface-track text-primary border border-card px-4 py-2.5 text-xs font-semibold hover:surface-subtle transition-all ios-active-scale cursor-pointer"
            >
              <Check className="h-4 w-4 text-accent-green stroke-[2.5]" />
              <span>{t('completeSession')}</span>
            </button>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onToggleActive}
        aria-label={focusCtaLabel}
        className={`focus-ring md:hidden w-full max-w-xs py-3.5 rounded-full text-sm font-bold text-on-accent transition-all ios-active-scale cursor-pointer shadow-md hover:brightness-110 ${!isTimerActive ? 'timer-cta-idle' : ''}`}
        style={{ backgroundColor: activeColor, ['--timer-cta-color' as string]: activeColor }}
      >
        {focusCtaLabel}
      </button>

      {(isTimerActive || secondsElapsed > 0) && (
        <div className="flex md:hidden items-center gap-2 w-full">
          <button
            type="button"
            onClick={onExtend}
            aria-label={t('timerExtendFiveMinAria')}
            className="focus-ring flex-1 px-4 py-2.5 rounded-full text-xs font-bold border border-accent-purple/20 bg-accent-purple/10 hover:bg-accent-purple/20 text-accent-purple transition-all ios-active-scale cursor-pointer"
          >
            {t('extendFiveMin')}
          </button>
          <button
            type="button"
            onClick={onComplete}
            aria-label={t('timerCompleteSessionAria')}
            className="focus-ring flex-1 flex items-center justify-center gap-1.5 rounded-full surface-track text-primary border border-card px-4 py-2.5 text-xs font-semibold hover:surface-subtle transition-all ios-active-scale cursor-pointer"
          >
            <Check className="h-4 w-4 text-accent-green stroke-[2.5]" />
            <span>{t('completeSession')}</span>
          </button>
        </div>
      )}
      <p className="text-micro text-muted/80 hidden md:block">{t('hotkeyHint')}</p>
    </div>
  )
}
