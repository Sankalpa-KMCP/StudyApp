import React, { useState } from 'react'
import { Play, Pause, Check, ChevronLeft, Lock } from 'lucide-react'
import type { TaskItem } from '../db/types'
import { FOCUS_LOCKOUT, FOCUS_MODE } from '../lib/shared/uxTerms'

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
  const [showLockoutExitConfirm, setShowLockoutExitConfirm] = useState(false)
  if (!isZenMode) return null

  const activeTask = sessionTasks.find(t => t.id === activeTaskId)
  const canExit = !(enforceLockout && isTimerActive && timerMode === 'study')

  const handleExitAttempt = () => {
    if (canExit) {
      setIsZenMode(false)
    } else {
      setShowLockoutExitConfirm(true)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden transition-opacity duration-1000 animate-fade-in"
      style={{ background: pageGradient }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

      <button
        onClick={handleExitAttempt}
        aria-label={canExit ? `Exit ${FOCUS_MODE.toLowerCase()}` : `${FOCUS_LOCKOUT} active — confirm to exit`}
        className="absolute top-6 right-6 z-20 flex items-center gap-2 rounded-full surface-track border border-card px-4 py-2 text-caption font-semibold text-secondary hover:opacity-90 hover:text-primary transition-all cursor-pointer ios-active-scale"
        title={canExit ? `Exit ${FOCUS_MODE.toLowerCase()}` : `${FOCUS_LOCKOUT} active`}
      >
        {!canExit && <Lock className="h-3 w-3 text-accent-amber" />}
        <span className="hidden sm:inline">Exit</span>
        {!canExit && <span className="text-micro text-accent-amber ml-0.5">(Locked)</span>}
      </button>

      <div className="relative z-10 flex flex-col items-center text-center space-y-8 select-none max-w-md px-6 animate-slide-in-up">
        <div className="text-center" aria-live="polite" aria-atomic="true">
          <p className="text-[5rem] sm:text-[7rem] md:text-[9rem] text-primary font-thin tracking-tighter leading-none tabular-nums select-none drop-shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
            {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:{String(remainingSeconds % 60).padStart(2, '0')}
          </p>
          <p className="text-caption text-secondary mt-3 uppercase tracking-wider font-semibold">
            {timerMode === 'study' ? 'Deep study' : 'Resting'}
          </p>
        </div>

        <div className="mt-6 space-y-1 max-w-sm">
          <p className="text-sm text-secondary tracking-wide">
            {activeTask && !activeTask.completed ? activeTask.text : 'Choose a focus target when you return'}
          </p>
        </div>

        <div className="flex items-center gap-4 pt-4">
          <button
            type="button"
            onClick={() => setIsTimerActive(!isTimerActive)}
            aria-label={isTimerActive ? 'Pause session' : 'Start session'}
            className="flex h-14 w-14 items-center justify-center rounded-full surface-track text-primary border border-card hover:opacity-90 active:scale-95 cursor-pointer transition-all duration-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] ios-active-scale"
          >
            {isTimerActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-white" />}
          </button>
          <button
            onClick={completeSession}
            className="flex items-center gap-2 rounded-full bg-accent-blue text-on-accent hover:bg-accent-blue/95 active:scale-95 cursor-pointer transition-all duration-300 shadow-lg px-8 py-3.5 text-caption font-semibold tracking-wide border border-card ios-active-scale"
          >
            <Check className="h-4 w-4 stroke-[2]" />
            Complete focus
          </button>
        </div>
      </div>

      <button
        onClick={handleExitAttempt}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full surface-subtle border border-card hover:surface-track text-secondary hover:text-primary transition-all duration-300 cursor-pointer shadow-md ios-active-scale md:hidden"
        title={`Exit ${FOCUS_MODE.toLowerCase()}`}
        aria-label={`Exit ${FOCUS_MODE.toLowerCase()}`}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {showLockoutExitConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 modal-backdrop backdrop-blur-md animate-fade-in">
          <div className="border border-card surface-overlay p-6 rounded-[24px] max-w-sm w-full text-center shadow-2xl space-y-4 animate-slide-in-up">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-amber/10 border border-accent-amber/20 text-accent-amber mx-auto">
              <Lock className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-primary uppercase tracking-wider">{FOCUS_LOCKOUT} active</h4>
            <p className="text-caption text-secondary leading-relaxed">
              You enabled lockout to prevent distraction. Pause your study timer to exit focus mode.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  setIsTimerActive(false)
                  setIsZenMode(false)
                  setShowLockoutExitConfirm(false)
                }}
                className="w-full py-2.5 rounded-xl text-caption font-bold bg-accent-blue hover:bg-accent-blue/90 text-on-accent transition-all cursor-pointer"
              >
                Pause Timer & Exit
              </button>
              <button
                onClick={() => setShowLockoutExitConfirm(false)}
                className="w-full py-2.5 rounded-xl text-caption font-bold surface-track hover:opacity-90 text-primary transition-all cursor-pointer"
              >
                Keep Studying
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
