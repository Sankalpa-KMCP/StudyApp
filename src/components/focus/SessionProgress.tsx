import { SESSIONS_BEFORE_LONG_BREAK } from '../../lib/shared/uxTerms'

interface SessionProgressProps {
  completedSessionsInCycle: number
  targetSessionsPerCycle: number
}

export function SessionProgress({ completedSessionsInCycle, targetSessionsPerCycle }: SessionProgressProps) {
  return (
    <div className="flex flex-col items-center gap-1 mt-5 select-none">
      <div className="flex items-center gap-3 text-label text-white/40 font-bold uppercase tracking-wider">
        <span>{SESSIONS_BEFORE_LONG_BREAK}:</span>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: targetSessionsPerCycle }, (_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full transition-all duration-300 border ${
                i < completedSessionsInCycle
                  ? 'bg-accent-amber border-accent-amber'
                  : 'bg-transparent border-white/10'
              }`}
            />
          ))}
        </div>
      </div>
      <p className="text-micro text-white/35">Dots = sessions before long break</p>
    </div>
  )
}
