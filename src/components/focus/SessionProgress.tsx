import { useTranslation } from '../../i18n/useTranslation'

interface SessionProgressProps {
  completedSessionsInCycle: number
  targetSessionsPerCycle: number
}

export function SessionProgress({ completedSessionsInCycle, targetSessionsPerCycle }: SessionProgressProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-1 mt-5 select-none">
      <div className="flex items-center gap-3 text-label text-muted font-bold uppercase tracking-wider">
        <span>{t('sessionsBeforeLongBreak')}:</span>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: targetSessionsPerCycle }, (_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full transition-all duration-300 border ${
                i < completedSessionsInCycle
                  ? 'bg-accent-amber border-accent-amber'
                  : 'bg-transparent border-card'
              }`}
            />
          ))}
        </div>
      </div>
      <p className="text-micro text-muted">Dots = sessions before long break</p>
    </div>
  )
}
