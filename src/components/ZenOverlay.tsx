import React from 'react'
import { Play, Pause, Check, ChevronLeft, X } from 'lucide-react'
import type { TaskItem } from '../db/types'

interface ZenOverlayProps {
  isZenMode: boolean
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  remainingSeconds: number
  timerMode: 'study' | 'break'
  sessionTasks: TaskItem[]
  activeTaskId: number | null
  isTimerActive: boolean
  setIsTimerActive: (active: boolean) => void
  completeSession: () => void
  enforceLockout: boolean
  setIsZenMode: (zen: boolean) => void
  pageGradient: string
}

export const ZenOverlay: React.FC<ZenOverlayProps> = ({
  isZenMode,
  canvasRef,
  remainingSeconds,
  timerMode,
  sessionTasks,
  activeTaskId,
  isTimerActive,
  setIsTimerActive,
  completeSession,
  enforceLockout,
  setIsZenMode,
  pageGradient,
}) => {
  if (!isZenMode) return null

  const activeTask = sessionTasks.find(t => t.id === activeTaskId)
  const canExit = !(enforceLockout && isTimerActive && timerMode === 'study')

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden transition-opacity duration-1000 animate-fade-in"
      style={{ background: pageGradient }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

      {canExit && (
        <button
          onClick={() => setIsZenMode(false)}
          className="absolute top-6 right-6 z-20 flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-4 py-2 text-caption font-semibold text-white/80 hover:bg-white/15 hover:text-white transition-all cursor-pointer ios-active-scale"
          title="Exit sanctuary"
        >
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">Exit</span>
        </button>
      )}

      <div className="relative z-10 flex flex-col items-center text-center space-y-8 select-none max-w-md px-6 animate-slide-in-up">
        <div className="text-center" aria-live="polite" aria-atomic="true">
          <p className="text-[5rem] sm:text-[7rem] md:text-[9rem] text-white/90 font-thin tracking-tighter leading-none tabular-nums select-none drop-shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
            {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:{String(remainingSeconds % 60).padStart(2, '0')}
          </p>
          <p className="text-caption text-white/60 mt-3 uppercase tracking-wider font-semibold">
            {timerMode === 'study' ? 'Deep study' : 'Resting'}
          </p>
        </div>

        <div className="mt-6 space-y-1 max-w-sm">
          <p className="text-sm text-white/80 tracking-wide">
            {activeTask && !activeTask.completed ? activeTask.text : 'Choose a focus target when you return'}
          </p>
        </div>

        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={() => setIsTimerActive(!isTimerActive)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white border border-white/10 hover:bg-white/15 active:scale-95 cursor-pointer transition-all duration-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] ios-active-scale"
            title={isTimerActive ? 'Pause session' : 'Start session'}
          >
            {isTimerActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-white" />}
          </button>
          <button
            onClick={completeSession}
            className="flex items-center gap-2 rounded-full bg-accent-blue text-white hover:bg-accent-blue/95 active:scale-95 cursor-pointer transition-all duration-300 shadow-lg px-8 py-3.5 text-caption font-semibold tracking-wide border border-white/10 ios-active-scale"
          >
            <Check className="h-4 w-4 stroke-[2]" />
            Complete focus
          </button>
        </div>
      </div>

      {canExit && (
        <button
          onClick={() => setIsZenMode(false)}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/5 border border-white/8 hover:bg-white/10 text-white/70 hover:text-white transition-all duration-300 cursor-pointer shadow-md ios-active-scale md:hidden"
          title="Exit sanctuary"
          aria-label="Exit sanctuary"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}
