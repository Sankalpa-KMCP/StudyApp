import { useEffect, useMemo, useState } from 'react'

export function BreakBreathingPacer() {
  const [breathTime, setBreathTime] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setBreathTime(t => (t + 1) % 12), 1250)
    return () => clearInterval(interval)
  }, [])

  const currentScale = useMemo(() => {
    return breathTime < 5
      ? 1 + (breathTime / 5) * 0.25
      : breathTime < 7
      ? 1.25
      : 1.25 - ((breathTime - 7) / 5) * 0.25
  }, [breathTime])

  const phaseLabel = breathTime < 5 ? 'Inhale' : breathTime < 7 ? 'Hold' : 'Exhale'

  return (
    <div className="mt-4 glass-tier-2 p-3.5 flex flex-col items-center gap-3.5 shadow-md transition-all duration-300 animate-slide-in-up">
      <div className="flex justify-between w-full text-label tracking-wider text-muted uppercase font-bold">
        <span>Respiration Pacer</span>
      </div>

      <div className="flex items-center gap-4.5 w-full justify-center">
        <div className="relative flex h-14 w-14 items-center justify-center shrink-0 select-none">
          <div
            className="absolute inset-0 rounded-full bg-accent-purple/5 border border-accent-purple/10 transition-all duration-[1250ms] ease-in-out"
            style={{
              transform: `scale(${currentScale * 1.3})`,
              opacity: breathTime < 5 ? 0.3 : breathTime < 7 ? 0.6 : 0.15,
            }}
          />
          <div
            className="absolute inset-1.5 rounded-full bg-accent-purple/10 border border-accent-purple/20 transition-all duration-[1250ms] ease-in-out"
            style={{
              transform: `scale(${currentScale * 1.15})`,
              opacity: breathTime < 5 ? 0.45 : breathTime < 7 ? 0.8 : 0.2,
            }}
          />
          <div
            className="relative flex h-8 w-8 items-center justify-center rounded-full bg-accent-purple/20 border border-accent-purple/40 transition-all duration-[1250ms] ease-in-out shadow-[0_0_12px_rgba(175,82,222,0.2)]"
            style={{ transform: `scale(${currentScale})` }}
          >
            <div className="h-3.5 w-3.5 rounded-full bg-accent-purple" />
          </div>
        </div>

        <div className="flex flex-col select-none max-w-[170px]">
          <span className="text-xs font-bold tracking-wide text-accent-purple uppercase">
            {phaseLabel}
          </span>
          <span className="text-caption text-muted mt-1 leading-normal font-medium">
            Slow breathing helps reset focus between blocks.
          </span>
        </div>
      </div>
    </div>
  )
}
