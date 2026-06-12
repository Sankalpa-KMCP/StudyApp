import { useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { ModalShell } from './shared/ModalShell'
import { Button } from './shared/Button'

interface LevelUpModalProps {
  level: number
  xpProgressPercent: number
  onDismiss: () => void
}

export function LevelUpModal({ level, xpProgressPercent, onDismiss }: LevelUpModalProps) {
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
      panelClassName="max-w-sm bg-white/5 p-6 text-center shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-accent-amber/15 border border-accent-amber/30 flex items-center justify-center">
          <Sparkles className="h-7 w-7 text-accent-amber" />
        </div>
        <div>
          <p className="text-label font-bold uppercase tracking-widest text-muted mb-1">Level up</p>
          <h2 id="level-up-title" className="text-3xl font-extrabold text-primary">Level {level}</h2>
          <p className="text-caption text-muted mt-2">Your focus is paying off — keep the momentum going.</p>
        </div>
        <div className="w-full">
          <div className="flex justify-between text-micro font-mono text-muted mb-1.5">
            <span>XP progress</span>
            <span>{Math.round(xpProgressPercent)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10 border border-white/10 overflow-hidden">
            <div
              className="h-full bg-accent-amber transition-all duration-500"
              style={{ width: `${xpProgressPercent}%` }}
            />
          </div>
        </div>
        <Button variant="primary" onClick={onDismiss} className="w-full">
          Keep focusing
        </Button>
      </div>
    </ModalShell>
  )
}
