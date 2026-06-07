import React, { useMemo } from 'react'
import { Play, Pause, Check, Sparkles } from 'lucide-react'

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
  breathTime: number
  setIsZenMode: (zen: boolean) => void
  soundEnabled: boolean
  noiseType: 'white' | 'pink' | 'brown'
  binauralTarget: 'alpha' | 'theta' | 'beta'
  updateSetting: (key: any, val: any) => void
  localVolumeRain: number
  setLocalVolumeRain: (v: number) => void
  localVolumeCafe: number
  setLocalVolumeCafe: (v: number) => void
  localVolumeWhiteNoise: number
  setLocalVolumeWhiteNoise: (v: number) => void
  localAlphaWaves: number
  setLocalAlphaWaves: (v: number) => void
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
  breathTime,
  setIsZenMode
}) => {
  // Trigonometric coordinate mapping for glowing revolving pointer dot
  const pointerCoords = useMemo(() => {
    const radius = 48 // align with inner dial circle
    const angle = -Math.PI / 2 + (progress * Math.PI * 2)
    return {
      x: 60 + radius * Math.cos(angle),
      y: 60 + radius * Math.sin(angle)
    }
  }, [progress])

  return (
    <div className="grid grid-cols-1 gap-6 w-full flex-1 items-start animate-fade-in">
      
      {/* Clock sanctuary block */}
      <div className="flex flex-col gap-6 w-full">
        
        {/* main card wrapper */}
        <div className="relative overflow-hidden flex flex-col border border-white/[0.08] dynamic-card p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_24px_48px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between mb-6">
            <span className="font-serif-luxury italic tracking-wider text-white/50 text-[10px] uppercase select-none">01 / CHRONOS ENGINE</span>
            <button
              onClick={() => setIsZenMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-wider border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 ease-out cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
            >
              <Sparkles className="h-3 w-3 text-accent-blue" />
              <span>Sanctuary Mode (Z)</span>
            </button>
          </div>

          {/* Timer Dial Display */}
          <div className="flex flex-col items-center py-6">
            <div className="relative flex h-56 w-56 items-center justify-center bg-white/[0.01] rounded-full border border-white/[0.03] shadow-[inset_0_0_24px_rgba(255,255,255,0.01)]">
              
              <svg className="absolute h-[92%] w-[92%] -rotate-90 overflow-visible" viewBox="0 0 120 120">
                {/* Thin outer dashboard circle indicating total cycle progress */}
                <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.015)" strokeWidth="0.75" />
                <circle
                  cx="60" cy="60" r="54"
                  fill="none"
                  stroke="var(--color-accent-amber)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray="339.3"
                  strokeDashoffset={String(339.3 * (1 - Math.min(1, completedSessionsInCycle / targetSessionsPerCycle)))}
                  style={{
                    transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                    opacity: completedSessionsInCycle > 0 ? 0.75 : 0.15,
                    filter: `drop-shadow(0 0 4px var(--color-accent-amber)50)`
                  }}
                />

                {/* Inner focus timer circular track */}
                <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3" />
                <circle
                  cx="60" cy="60" r="48"
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="301.6"
                  strokeDashoffset={String(301.6 * (1 - progress))}
                  style={{
                    stroke: timerMode === 'study' ? 'var(--color-accent-blue)' : isLongBreak ? 'var(--color-accent-green)' : 'var(--color-accent-amber)',
                    transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s',
                    filter: `drop-shadow(0 0 12px ${timerMode === 'study' ? 'var(--color-accent-blue)' : isLongBreak ? 'var(--color-accent-green)' : 'var(--color-accent-amber)'}60)`
                  }}
                />

                {/* revolving pointer dot node */}
                {isTimerActive && progress > 0 && (
                  <circle
                    cx={pointerCoords.x}
                    cy={pointerCoords.y}
                    r="3.5"
                    fill="white"
                    style={{
                      filter: `drop-shadow(0 0 6px ${timerMode === 'study' ? 'var(--color-accent-blue)' : isLongBreak ? 'var(--color-accent-green)' : 'var(--color-accent-amber)'})`,
                      transition: 'cx 0.8s cubic-bezier(0.16, 1, 0.3, 1), cy 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                  />
                )}
              </svg>
              
              <div className="text-center z-10">
                <p className="text-5xl font-extralight text-gradient-metallic font-mono tracking-tight tabular-nums select-none drop-shadow-[0_2px_16px_rgba(255,255,255,0.08)]">
                  {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:{String(remainingSeconds % 60).padStart(2, '0')}
                </p>
                <span className="inline-block rounded-full bg-white/[0.04] border border-white/5 px-2.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white/60 mt-2 select-none">
                  {timerMode === 'study' ? 'Study Block' : isLongBreak ? 'Long Break' : 'Short Break'}
                </span>
              </div>

            </div>

            {/* Quick Controls */}
            <div className="flex items-center gap-3 mt-8">
              <button
                onClick={() => handleModeSwitch(timerMode === 'study' ? 'break' : 'study')}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 transition-all duration-300 ease-out cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:border-white/15"
              >
                Switch to {timerMode === 'study' ? 'Break' : 'Study'}
              </button>
              
              <button
                onClick={() => setIsTimerActive(a => !a)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/15 hover:border-white/30 transition-all duration-300 ease-out active:scale-95 cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),_0_4px_12px_rgba(0,0,0,0.15)]"
              >
                {isTimerActive ? <Pause className="h-4.5 w-4.5 text-accent-blue" /> : <Play className="h-4.5 w-4.5" />}
              </button>

              {(isTimerActive || secondsElapsed > 0) && (
                <button
                  onClick={completeSession}
                  className="flex items-center gap-1.5 rounded-xl bg-white/20 text-white border border-white/30 px-4 py-2 text-xs font-bold transition-all duration-300 ease-out hover:bg-white/25 hover:border-white/40 active:scale-95 cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),_0_4px_12px_rgba(0,0,0,0.15)]"
                >
                  <Check className="h-4 w-4 stroke-[2.5] text-accent-green" />
                  <span>Complete</span>
                </button>
              )}
            </div>

            {/* Progress Cycle Tracker */}
            <div className="flex items-center gap-2.5 mt-5 text-[9px] text-slate-400 font-bold uppercase tracking-wider bg-white/[0.02] border border-white/5 px-4 py-1.5 rounded-full select-none">
              <span>Sprint Cycle:</span>
              <div className="flex items-center gap-1.5" title={`${completedSessionsInCycle} of ${targetSessionsPerCycle} completed`}>
                {Array.from({ length: targetSessionsPerCycle }, (_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-2 rounded-full transition-all duration-300 border ${
                      i < completedSessionsInCycle
                        ? 'bg-accent-blue border-accent-blue scale-110 shadow-[0_0_6px_var(--color-accent-blue)]'
                        : 'bg-white/5 border-white/5'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Guided HRV Coherence Breath Pacer (Active during Break) */}
          {timerMode !== 'study' && (
            <div className="mt-2 border border-white/[0.06] bg-[#0d101a]/30 rounded-2xl p-4 flex flex-col items-center gap-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] transition-all duration-500 animate-slide-in-up">
              <div className="flex justify-between w-full text-[9px] font-mono tracking-wider text-white/40 uppercase font-bold">
                <span>Respiration Pacer</span>
                <span className="text-[9px] text-accent-purple tracking-widest animate-pulse font-mono">Breathe Mode</span>
              </div>
              
              <div className="flex items-center gap-5 py-2 w-full justify-center">
                {/* Animated Breathing Circle */}
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/10 transition-all duration-1000 ease-in-out bg-white/[0.01]"
                  style={{
                    transform: breathTime < 5 ? `scale(${1 + (breathTime / 5) * 0.25})` : breathTime < 7 ? 'scale(1.25)' : `scale(${1.25 - ((breathTime - 7) / 5) * 0.5})`,
                    borderColor: breathTime < 5 ? 'rgba(var(--color-accent-purple-rgb),0.3)' : breathTime < 7 ? 'rgba(var(--color-accent-purple-rgb),0.8)' : 'rgba(var(--color-accent-purple-rgb),0.3)',
                    boxShadow: breathTime < 5 ? '0 0 10px rgba(var(--color-accent-purple-rgb),0.1)' : breathTime < 7 ? '0 0 25px rgba(var(--color-accent-purple-rgb),0.3)' : '0 0 10px rgba(var(--color-accent-purple-rgb),0.1)',
                  }}
                >
                  <div className="h-5 w-5 rounded-full bg-accent-purple/40 blur-md animate-pulse" />
                </div>

                <div className="flex flex-col select-none">
                  <span className="text-sm font-mono font-bold tracking-widest text-white uppercase text-gradient-accent">
                    {breathTime < 5 ? 'Inhale 🌬️' : breathTime < 7 ? 'Hold 🧘' : 'Exhale 💨'}
                  </span>
                  <span className="text-[9px] text-slate-450 mt-0.5">
                    Cohere cardiac rhythm to stabilize autonomic nervous system.
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* HRV Coherence Pacer Card (Active during Study) */}
        {timerMode === 'study' && (
          <div className="border border-white/[0.06] bg-gradient-to-br from-white/[0.02] to-white/[0.005] dynamic-card p-5 animate-hrv-pacer shadow-md select-none">
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-[8px] font-bold font-mono tracking-widest text-white/60 uppercase bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">Resonance Metrics</span>
              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">8s Heart Wave</span>
            </div>
            <div className="flex items-center gap-4 bg-[#0a0d16]/50 border border-white/5 px-4 py-3 rounded-2xl">
              <div className="relative flex h-10 w-10 items-center justify-center shrink-0">
                <div className="absolute inset-0 rounded-full border border-accent-purple/30 animate-zen-breath" />
                <div className="h-3.5 w-3.5 rounded-full bg-accent-purple shadow-[0_0_8px_var(--color-accent-purple)] animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Coherence Visualizer Active</p>
                <p className="text-[10px] text-slate-500 leading-normal mt-0.5">Focusing on long, regulated breathing resets heart-rate variability, shifting from sympathetic stress to parasympathetic focus.</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
