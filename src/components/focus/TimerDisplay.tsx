import { useTranslation } from '../../i18n/useTranslation'

interface TimerDisplayProps {
  remainingSeconds: number
  progress: number
  timerMode: 'study' | 'break'
  isLongBreak: boolean
  isTimerActive: boolean
  activeColor: string
}

export function TimerDisplay({
  remainingSeconds,
  progress,
  timerMode,
  isLongBreak,
  isTimerActive,
  activeColor,
}: TimerDisplayProps) {
  const { t } = useTranslation()

  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0')
  const seconds = String(remainingSeconds % 60).padStart(2, '0')
  const timeDisplay = `${minutes}:${seconds}`

  const modeLabel =
    timerMode === 'study'
      ? t('timerModeStudyBlock')
      : isLongBreak
      ? t('timerModeLongBreak')
      : t('timerModeShortBreak')

  return (
    <div
      aria-label={t('timerRingAria', { mode: modeLabel, time: timeDisplay })}
      className={`relative flex h-52 w-52 md:h-72 md:w-72 focus-timer-ring glass-hero items-center justify-center rounded-full overflow-hidden ${
        timerMode === 'study' && isTimerActive ? 'focus-timer-ring--active' : ''
      }`}
      style={{ '--timer-ring-color': activeColor } as React.CSSProperties}
    >
      <div
        className="absolute inset-[3%] rounded-full opacity-15 blur-2xl pointer-events-none transition-all duration-700 ease-out"
        style={{
          background: `radial-gradient(circle, ${activeColor} 0%, transparent 70%)`,
        }}
      />
      <svg className="absolute h-[94%] w-[94%] -rotate-90 overflow-visible" viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-border-card)" strokeWidth="2" />
        <circle
          cx="60" cy="60" r="50"
          fill="none"
          stroke={activeColor}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray="314.16"
          strokeDashoffset={String(314.16 * (1 - progress))}
          style={{
            transition: 'stroke-dashoffset 0.35s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s',
            filter: `drop-shadow(0 0 8px ${activeColor})`,
          }}
        />
      </svg>

      <div className="text-center z-10 select-none" aria-live="polite" aria-atomic="true">
        <p
          className="text-display font-display text-primary tabular-nums timer-text-glow"
          style={{ '--timer-glow-color': activeColor } as React.CSSProperties}
          role="timer"
        >
          {timeDisplay}
        </p>
        <span className="timer-mode-badge mt-3">
          <span className="timer-mode-badge__dot" aria-hidden />
          {modeLabel}
        </span>
      </div>
    </div>
  )
}
