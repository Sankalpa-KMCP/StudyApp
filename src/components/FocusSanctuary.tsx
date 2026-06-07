import React, { useMemo } from 'react'
import { Play, Pause, Check, Sparkles, Zap, Heart } from 'lucide-react'

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

  // Get active color tags based on timer state
  const activeColor = useMemo(() => {
    if (timerMode === 'study') return 'var(--color-accent-blue)'
    if (isLongBreak) return 'var(--color-accent-green)'
    return 'var(--color-accent-amber)'
  }, [timerMode, isLongBreak])

  return (
    <div className="grid grid-cols-1 gap-6 w-full flex-1 items-start animate-fade-in">
      
      {/* Clock Sanctuary Block */}
      <div className="flex flex-col gap-6 w-full">
        
        {/* Main Card Wrapper */}
        <div className="relative overflow-hidden flex flex-col border border-white/[0.08] dynamic-card p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_24px_48px_rgba(0,0,0,0.4)]">
          
          {/* Subtle Ambient Radial Backglow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full blur-[90px] -z-10 opacity-[0.08] pointer-events-none transition-all duration-500"
            style={{ backgroundColor: activeColor }}
          />

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-accent-blue animate-pulse" />
              <span className="font-mono text-[9px] font-black uppercase tracking-widest text-white/50 select-none">01 / CHRONOS ENGINE</span>
            </div>
            <button
              onClick={() => setIsZenMode(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20 hover:scale-105 transition-all duration-300 ease-out cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent-amber animate-pulse" />
              <span>Sanctuary Mode</span>
            </button>
          </div>

          {/* Timer Dial Display */}
          <div className="flex flex-col items-center py-4">
            <div className="relative flex h-60 w-60 items-center justify-center bg-white/[0.005] rounded-full border border-white/[0.05] shadow-[inset_0_0_40px_rgba(255,255,255,0.01),0_8px_32px_rgba(0,0,0,0.3)]">
              
              <svg className="absolute h-[94%] w-[94%] -rotate-90 overflow-visible" viewBox="0 0 120 120">
                {/* Gradient Definitions */}
                <defs>
                  <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--color-accent-blue)" />
                    <stop offset="100%" stopColor="var(--color-accent-purple)" />
                  </linearGradient>
                  <linearGradient id="breakGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--color-accent-green)" />
                    <stop offset="100%" stopColor="var(--color-accent-blue)" />
                  </linearGradient>
                  <linearGradient id="shortBreakGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--color-accent-amber)" />
                    <stop offset="100%" stopColor="var(--color-accent-purple)" />
                  </linearGradient>
                </defs>

                {/* Outer Cycle Indicator Track */}
                <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.01)" strokeWidth="0.75" />
                <circle
                  cx="60" cy="60" r="54"
                  fill="none"
                  stroke="var(--color-accent-amber)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="339.3"
                  strokeDashoffset={String(339.3 * (1 - Math.min(1, completedSessionsInCycle / targetSessionsPerCycle)))}
                  style={{
                    transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)',
                    opacity: completedSessionsInCycle > 0 ? 0.85 : 0.1,
                    filter: `drop-shadow(0 0 6px var(--color-accent-amber)40)`
                  }}
                />

                {/* Inner focus timer circular track */}
                <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="3" />
                <circle
                  cx="60" cy="60" r="48"
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="301.6"
                  strokeDashoffset={String(301.6 * (1 - progress))}
                  style={{
                    stroke: timerMode === 'study' ? 'url(#focusGradient)' : isLongBreak ? 'url(#breakGradient)' : 'url(#shortBreakGradient)',
                    transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.5s',
                    filter: `drop-shadow(0 0 10px ${activeColor}50)`
                  }}
                />

                {/* Revolving pointer dot node */}
                {isTimerActive && progress > 0 && (
                  <circle
                    cx={pointerCoords.x}
                    cy={pointerCoords.y}
                    r="4"
                    fill="white"
                    style={{
                      filter: `drop-shadow(0 0 8px ${activeColor})`,
                      transition: 'cx 0.8s cubic-bezier(0.16, 1, 0.3, 1), cy 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                  />
                )}
              </svg>

              {/* Central Wave Aura / Coherence Visualization */}
              <div className="absolute inset-8 rounded-full bg-black/40 border border-white/5 flex items-center justify-center overflow-hidden">
                <svg className="absolute w-full h-[60%] opacity-20 pointer-events-none" viewBox="0 0 100 40">
                  <path
                    d={timerMode === 'study' 
                      ? "M0,20 Q15,5 30,20 T60,20 T90,20 T100,20" 
                      : `M0,20 Q15,${20 - (breathTime < 5 ? breathTime * 3 : (12 - breathTime) * 1.5)} 30,20 T60,20 T90,20 T100,20`
                    }
                    fill="none"
                    stroke={activeColor}
                    strokeWidth="1.5"
                    className="wave-path"
                  />
                  <path
                    d={timerMode === 'study' 
                      ? "M0,20 Q10,30 25,20 T50,20 T75,20 T100,20" 
                      : `M0,20 Q10,${20 + (breathTime < 5 ? breathTime * 2 : (12 - breathTime) * 1)} 25,20 T50,20 T75,20 T100,20`
                    }
                    fill="none"
                    stroke={activeColor}
                    strokeWidth="0.75"
                    className="wave-path"
                    style={{ animationDelay: '-3s', opacity: 0.5 }}
                  />
                </svg>

                <div className="text-center z-10 select-none">
                  <p className="text-5xl font-black text-gradient-metallic font-mono tracking-tight tabular-nums drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                    {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:{String(remainingSeconds % 60).padStart(2, '0')}
                  </p>
                  <span className="inline-block rounded-full bg-white/[0.04] border border-white/10 px-3 py-1 text-[8px] font-black uppercase tracking-widest text-white/70 mt-3 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                    {timerMode === 'study' ? 'Study Block' : isLongBreak ? 'Long Break' : 'Short Break'}
                  </span>
                </div>
              </div>

            </div>

            {/* Dial Interaction Controls */}
            <div className="flex items-center gap-4 mt-8 select-none">
              <button
                onClick={() => handleModeSwitch(timerMode === 'study' ? 'break' : 'study')}
                className="px-4.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border border-white/10 bg-white/5 hover:bg-white/10 text-white/95 transition-all duration-300 ease-out cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.2)] hover:border-white/20 active:scale-95"
              >
                Switch to {timerMode === 'study' ? 'Break' : 'Study'}
              </button>
              
              <button
                onClick={() => setIsTimerActive(a => !a)}
                className="flex h-11.5 w-11.5 items-center justify-center rounded-xl bg-white/10 text-white border border-white/25 hover:bg-white/15 hover:border-white/35 transition-all duration-300 ease-out active:scale-90 cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),_0_6px_16px_rgba(0,0,0,0.3)]"
              >
                {isTimerActive ? <Pause className="h-5 w-5 text-accent-blue" /> : <Play className="h-5 w-5" />}
              </button>

              {(isTimerActive || secondsElapsed > 0) && (
                <button
                  onClick={completeSession}
                  className="flex items-center gap-2 rounded-xl bg-white/20 text-white border border-white/35 px-4.5 py-2.5 text-xs font-black uppercase tracking-wider transition-all duration-300 ease-out hover:bg-white/25 hover:border-white/45 active:scale-90 cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),_0_6px_16px_rgba(0,0,0,0.3)]"
                >
                  <Check className="h-4.5 w-4.5 stroke-[3] text-accent-green" />
                  <span>Complete</span>
                </button>
              )}
            </div>

            {/* Progress Cycle dots */}
            <div className="flex items-center gap-3.5 mt-6 text-[8px] text-slate-400 font-mono font-black uppercase tracking-widest bg-white/[0.02] border border-white/5 px-4.5 py-2 rounded-full select-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.01)]">
              <span>Sprint Cycle:</span>
              <div className="flex items-center gap-2" title={`${completedSessionsInCycle} of ${targetSessionsPerCycle} completed`}>
                {Array.from({ length: targetSessionsPerCycle }, (_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-2.5 rounded-full transition-all duration-500 border ${
                      i < completedSessionsInCycle
                        ? 'bg-accent-blue border-accent-blue scale-110 shadow-[0_0_8px_var(--color-accent-blue)]'
                        : 'bg-white/5 border-white/10'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Guided HRV Respiration Breath Pacer (Active during Break) */}
          {timerMode !== 'study' && (
            <div className="mt-4 border border-white/[0.08] bg-white/[0.01] backdrop-blur-xl rounded-2xl p-4 flex flex-col items-center gap-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-all duration-500 animate-slide-in-up">
              <div className="flex justify-between w-full text-[8px] font-mono tracking-widest text-white/45 uppercase font-black">
                <span>Respiration Pacer</span>
                <span className="text-[8px] text-accent-purple tracking-widest animate-pulse font-mono">Coherence Sync</span>
              </div>
              
              <div className="flex items-center gap-5.5 py-1 w-full justify-center">
                {/* Glowing breathing pacer concentric ring */}
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/10 transition-all duration-1000 ease-in-out bg-white/[0.01]"
                  style={{
                    transform: breathTime < 5 ? `scale(${1 + (breathTime / 5) * 0.22})` : breathTime < 7 ? 'scale(1.22)' : `scale(${1.22 - ((breathTime - 7) / 5) * 0.44})`,
                    borderColor: breathTime < 5 ? 'rgba(139, 92, 246, 0.4)' : breathTime < 7 ? 'rgba(139, 92, 246, 0.9)' : 'rgba(139, 92, 246, 0.4)',
                    boxShadow: breathTime < 5 ? '0 0 12px rgba(139, 92, 246, 0.15)' : breathTime < 7 ? '0 0 28px rgba(139, 92, 246, 0.45)' : '0 0 12px rgba(139, 92, 246, 0.15)',
                  }}
                >
                  <div className="h-6 w-6 rounded-full bg-accent-purple/35 blur-md animate-pulse" />
                </div>

                <div className="flex flex-col select-none max-w-[140px]">
                  <span className="text-xs font-mono font-black tracking-widest text-white uppercase text-gradient-accent">
                    {breathTime < 5 ? 'Inhale 🌬️' : breathTime < 7 ? 'Hold 🧘' : 'Exhale 💨'}
                  </span>
                  <span className="text-[9px] text-slate-450 mt-1 leading-normal font-semibold">
                    Cohere cardiac rhythm to optimize autonomous vagus stress control.
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* HRV Coherence Pacer Card (Active during Study) */}
        {timerMode === 'study' && (
          <div className="border border-white/[0.08] bg-gradient-to-br from-white/[0.02] to-white/[0.005] dynamic-card p-5 animate-hrv-pacer shadow-md select-none">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[8px] font-mono font-black tracking-widest text-white/50 uppercase bg-white/5 px-2.5 py-1 rounded-full border border-white/10">Resonance Metrics</span>
              <div className="flex items-center gap-1.5 text-accent-purple">
                <Heart className="h-3.5 w-3.5 animate-pulse text-accent-purple" />
                <span className="text-[9px] font-mono font-black uppercase tracking-widest">Coherent Pacing</span>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-black/40 border border-white/5 px-4 py-3 rounded-2xl">
              <div className="relative flex h-10 w-10 items-center justify-center shrink-0">
                <div className="absolute inset-0 rounded-full border border-accent-purple/30 animate-zen-breath" />
                <div className="h-3.5 w-3.5 rounded-full bg-accent-purple shadow-[0_0_12px_var(--color-accent-purple)] animate-pulse" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-slate-200">Coherence Visualizer Active</p>
                <p className="text-[10px] text-slate-500 leading-normal mt-1 font-semibold">Long, regulated breathing stabilizes heart-rate variability (HRV), shifting the brain from sympathetic stress to cognitive focus.</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
