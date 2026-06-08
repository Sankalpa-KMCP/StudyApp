import React, { useMemo } from 'react'
import { Play, Pause, Check, Sparkles, Heart } from 'lucide-react'
import { Button } from './shared/Button'

interface FocusSanctuaryProps {
  timerMode: 'study' | 'break'
  isTimerActive: boolean
  setIsTimerActive: React.Dispatch<React.SetStateAction<boolean>>
  remainingSeconds: number
  secondsElapsed: number
  progress: number
  isLongBreak: boolean
  completedSessionsInCycle: number
  targetSessionsPerCycle: number
  handleModeSwitch: (mode: 'study' | 'break') => void
  completeSession: () => void
  extendSession: () => void
  skipBreak: () => void
  breathTime: number
  setIsZenMode: (zen: boolean) => void
  onUserGesture?: () => void
  showReflectionModal?: boolean
}

export const FocusSanctuary: React.FC<FocusSanctuaryProps> = ({
  timerMode,
  isTimerActive,
  setIsTimerActive,
  remainingSeconds,
  secondsElapsed,
  progress,
  isLongBreak,
  completedSessionsInCycle,
  targetSessionsPerCycle,
  handleModeSwitch,
  completeSession,
  extendSession,
  skipBreak,
  breathTime,
  setIsZenMode,
  onUserGesture,
  showReflectionModal = false,
}) => {
  const activeColor = useMemo(() => {
    if (timerMode === 'study') return 'var(--color-accent-blue)'
    if (isLongBreak) return 'var(--color-accent-green)'
    return 'var(--color-accent-amber)'
  }, [timerMode, isLongBreak])

  const currentScale = useMemo(() => {
    return breathTime < 5
      ? 1 + (breathTime / 5) * 0.25
      : breathTime < 7
      ? 1.25
      : 1.25 - ((breathTime - 7) / 5) * 0.25
  }, [breathTime])

  return (
    <div className="grid grid-cols-1 gap-6 w-full flex-1 items-start animate-fade-in">
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {showReflectionModal && timerMode === 'study' ? 'Study block complete' : ''}
      </div>

      <div className="flex flex-col gap-6 w-full">
        <div className="flex flex-col border border-white/5 bg-white/[0.02] rounded-[28px] p-5 md:p-6 shadow-2xl backdrop-blur-3xl">
          <div className="flex items-center justify-between mb-5 border-b border-white/5 pb-3 select-none">
            <span className="text-label font-bold uppercase tracking-wider text-white/50">Focus Timer</span>
            <Button
              size="sm"
              onClick={() => setIsZenMode(true)}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent-blue" />
              <span>Sanctuary Mode</span>
            </Button>
          </div>

          <div className="flex justify-center gap-2 mb-4">
            {(['study', 'break'] as const).map(mode => {
              const isActive = timerMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleModeSwitch(mode)}
                  className={`px-4 py-2 rounded-full text-caption font-semibold transition-all ios-active-scale cursor-pointer ${
                    isActive
                      ? 'bg-accent-blue text-white border border-accent-blue/30 shadow-md shadow-accent-blue/15'
                      : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {mode === 'study' ? 'Study' : 'Break'}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col items-center py-2">
            <div className="relative flex h-60 w-60 md:h-64 md:w-64 items-center justify-center rounded-full border border-white/5 bg-black/10">
              <svg className="absolute h-[94%] w-[94%] -rotate-90 overflow-visible" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
                <circle
                  cx="60" cy="60" r="50"
                  fill="none"
                  stroke={activeColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="314.16"
                  strokeDashoffset={String(314.16 * (1 - progress))}
                  style={{ transition: 'stroke-dashoffset 0.3s ease-out, stroke 0.3s' }}
                />
              </svg>

              <div className="text-center z-10 select-none" aria-live="polite" aria-atomic="true">
                <p className="text-6xl md:text-7xl font-bold text-white tracking-tight tabular-nums" role="timer">
                  {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:{String(remainingSeconds % 60).padStart(2, '0')}
                </p>
                <span className="inline-block rounded-full bg-white/5 border border-white/5 px-3 py-0.5 text-label font-semibold uppercase tracking-wider text-white/60 mt-3">
                  {timerMode === 'study' ? 'Study Block' : isLongBreak ? 'Long Break' : 'Short Break'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-7 select-none flex-wrap justify-center">
              {timerMode === 'break' && (
                <button
                  onClick={skipBreak}
                  className="px-4 py-2.5 rounded-full text-xs font-bold border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all ios-active-scale cursor-pointer"
                >
                  Skip Break
                </button>
              )}

              <button
                onClick={() => { onUserGesture?.(); setIsTimerActive(a => !a) }}
                aria-label={isTimerActive ? 'Pause timer' : 'Start timer'}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-blue text-white hover:bg-accent-blue/90 transition-all ios-active-scale cursor-pointer shadow-md shadow-accent-blue/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {isTimerActive ? <Pause className="h-4.5 w-4.5" /> : <Play className="h-4.5 w-4.5" />}
              </button>

              {(isTimerActive || secondsElapsed > 0) && (
                <>
                  <button
                    onClick={extendSession}
                    className="px-4 py-2.5 rounded-full text-xs font-bold border border-accent-purple/20 bg-accent-purple/10 hover:bg-accent-purple/20 text-accent-purple transition-all ios-active-scale cursor-pointer"
                  >
                    +5 Min
                  </button>
                  <button
                    onClick={completeSession}
                    className="flex items-center gap-1.5 rounded-full bg-white/10 text-white border border-white/5 px-4 py-2.5 text-xs font-semibold hover:bg-white/15 transition-all ios-active-scale cursor-pointer"
                  >
                    <Check className="h-4 w-4 text-accent-green stroke-[2.5]" />
                    <span>Complete</span>
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 mt-5 text-label text-white/40 font-bold uppercase tracking-wider select-none">
              <span>Sprint Cycles:</span>
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
          </div>

          {timerMode !== 'study' && (
            <div className="mt-4 border border-white/5 bg-black/20 rounded-[20px] p-3.5 flex flex-col items-center gap-3.5 shadow-md transition-all duration-300 animate-slide-in-up">
              <div className="flex justify-between w-full text-label tracking-wider text-white/40 uppercase font-bold">
                <span>Respiration Pacer</span>
                <span className="text-accent-purple font-mono">Coherence Sync</span>
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
                    {breathTime < 5 ? 'Inhale' : breathTime < 7 ? 'Hold' : 'Exhale'}
                  </span>
                  <span className="text-caption text-white/50 mt-1 leading-normal font-medium">
                    Slow breathing helps reset focus between blocks.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {timerMode === 'study' && (
          <div className="border border-white/5 bg-white/[0.02] rounded-[28px] p-4.5 select-none shadow-2xl backdrop-blur-3xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-label font-bold tracking-wider text-white/40 uppercase bg-white/5 border border-white/5 px-2 py-0.5 rounded-full">Study tip</span>
              <div className="flex items-center gap-1.5 text-accent-purple">
                <Heart className="h-3.5 w-3.5" />
                <span className="text-label font-bold uppercase tracking-wider">Stay present</span>
              </div>
            </div>
            <div className="bg-black/20 border border-white/5 px-3.5 py-3 rounded-[20px]">
              <p className="text-xs font-bold text-white/90">One task at a time</p>
              <p className="text-caption text-white/50 leading-relaxed mt-1">Pick a single focus target and protect this block from context switches.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
