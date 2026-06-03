import React from 'react'
import { Play, Pause, Check, ChevronLeft } from 'lucide-react'
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
  localEnforceLockout: boolean
  setIsZenMode: (zen: boolean) => void
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
  localEnforceLockout,
  setIsZenMode
}) => {
  if (!isZenMode) return null

  const activeTask = sessionTasks.find(t => t.id === activeTaskId)

  return (
    <div className="fixed inset-0 z-50 bg-[#0d0d0f] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-1000 animate-fade-in">
      {/* HTML5 Canvas Ambient Particle Background */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

      {/* Centerpiece Layout */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-8 select-none max-w-md px-6 animate-slide-in-up">
        {/* Cinematic countdown clock */}
        <div className="text-center">
          <p className="text-[12rem] md:text-[15rem] text-white/90 font-extralight font-mono tracking-tight leading-none select-none drop-shadow-[0_4px_40px_rgba(255,255,255,0.05)]">
            {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:{String(remainingSeconds % 60).padStart(2, '0')}
          </p>
          <p className="text-xs text-white/60 mt-3 uppercase tracking-wider font-semibold">
            {timerMode === 'study' ? 'Deep Study' : 'Resting'}
          </p>
        </div>

        {/* Focus Anchor Text */}
        <div className="mt-10 space-y-1">
          <p className="text-xs font-serif-luxury italic text-white/80 tracking-widest uppercase">
            {activeTask && !activeTask.completed ? activeTask.text : 'Radiant Silence'}
          </p>
        </div>

        {/* Play/Pause controls */}
        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={() => setIsTimerActive(!isTimerActive)}
            className="flex h-12 w-12 items-center justify-center rounded-sm bg-accent-blue text-slate-950 border border-accent-blue hover:bg-accent-blue/90 active:scale-95 cursor-pointer animate-fade-in"
            title={isTimerActive ? "Pause session" : "Start session"}
          >
            {isTimerActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button
            onClick={completeSession}
            className="flex items-center gap-2 rounded-sm bg-accent-blue text-slate-950 border border-accent-blue px-6 py-3 text-xs font-bold hover:bg-accent-blue/90 active:scale-95 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            Complete Focus
          </button>
        </div>
      </div>

      {/* Minimal exit chevron */}
      {!(localEnforceLockout && isTimerActive && timerMode === 'study') && (
        <button
          onClick={() => setIsZenMode(false)}
          className="absolute top-8 left-8 flex h-10 w-10 items-center justify-center rounded-sm bg-[#0c0f17] border border-[#1b2333] hover:bg-[#0c0f17] text-[#64748b] transition-colors cursor-pointer"
          title="Exit Sanctuary"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}
