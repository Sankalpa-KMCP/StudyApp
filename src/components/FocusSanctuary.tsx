import React, { useMemo } from 'react'
import { Play, Pause, Check, Sparkles, Heart } from 'lucide-react'

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
  extendSession,
  skipBreak,
  breathTime,
  setIsZenMode
}) => {

  // Get active color based on state
  const activeColor = useMemo(() => {
    if (timerMode === 'study') return '#007aff' // system blue
    if (isLongBreak) return '#34c759' // system green
    return '#ff9500' // system orange
  }, [timerMode, isLongBreak])

  return (
    <div className="grid grid-cols-1 gap-6 w-full flex-1 items-start animate-fade-in">
      
      {/* Clock Sanctuary Block */}
      <div className="flex flex-col gap-6 w-full">
        
        {/* Main Card Wrapper */}
        <div className="flex flex-col border border-white/5 bg-white/[0.02] rounded-[28px] p-5 md:p-6 shadow-2xl backdrop-blur-3xl">
          
          {/* Section Header */}
          <div className="flex items-center justify-between mb-5 border-b border-white/5 pb-3 select-none">
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">01 / Focus Sanctuary</span>
            <button
              onClick={() => setIsZenMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white transition-all ios-active-scale cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent-blue" />
              <span>Sanctuary Mode</span>
            </button>
          </div>

          {/* Minimal Timer Dial Display */}
          <div className="flex flex-col items-center py-2">
            <div className="relative flex h-56 w-56 items-center justify-center rounded-full border border-white/5 bg-black/10">
              
              <svg className="absolute h-[94%] w-[94%] -rotate-90 overflow-visible" viewBox="0 0 120 120">
                {/* Thin background track */}
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
                
                {/* Clean progress indicator line */}
                <circle
                  cx="60" cy="60" r="50"
                  fill="none"
                  stroke={activeColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="314.16"
                  strokeDashoffset={String(314.16 * (1 - progress))}
                  style={{
                    transition: 'stroke-dashoffset 0.3s ease-out, stroke 0.3s'
                  }}
                />
              </svg>

              {/* Timer metrics display */}
              <div className="text-center z-10 select-none">
                <p className="text-5xl font-bold text-white tracking-tight tabular-nums">
                  {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:{String(remainingSeconds % 60).padStart(2, '0')}
                </p>
                <span className="inline-block rounded-full bg-white/5 border border-white/5 px-3 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/60 mt-2.5">
                  {timerMode === 'study' ? 'Study Block' : isLongBreak ? 'Long Break' : 'Short Break'}
                </span>
              </div>

            </div>

            {/* Dial Interaction Controls */}
            <div className="flex items-center gap-3 mt-7 select-none">
              {timerMode === 'break' && (
                <button
                  onClick={skipBreak}
                  className="px-4 py-2.5 rounded-full text-xs font-bold border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all ios-active-scale cursor-pointer"
                >
                  Skip Break
                </button>
              )}

              <button
                onClick={() => handleModeSwitch(timerMode === 'study' ? 'break' : 'study')}
                className="px-4 py-2.5 rounded-full text-xs font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-white/90 transition-all ios-active-scale cursor-pointer"
              >
                Switch to {timerMode === 'study' ? 'Break' : 'Study'}
              </button>
              
              <button
                onClick={() => setIsTimerActive(a => !a)}
                className="flex h-9.5 w-9.5 items-center justify-center rounded-full bg-accent-blue text-white hover:bg-accent-blue/90 transition-all ios-active-scale cursor-pointer shadow-md shadow-accent-blue/10"
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

            {/* Cycle Completed Indicator */}
            <div className="flex items-center gap-3 mt-5 text-[8px] text-white/40 font-bold uppercase tracking-wider select-none">
              <span>Sprint Cycles Completed:</span>
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

          {/* Guided Respiration Breath Pacer (Active during Break) */}
          {timerMode !== 'study' && (
            <div className="mt-4 border border-white/5 bg-black/20 rounded-[20px] p-3.5 flex flex-col items-center gap-3.5 shadow-md transition-all duration-300 animate-slide-in-up">
              <div className="flex justify-between w-full text-[8.5px] tracking-wider text-white/40 uppercase font-bold">
                <span>Respiration Pacer</span>
                <span className="text-[8.5px] text-accent-purple font-mono">Coherence Sync</span>
              </div>
              
              <div className="flex items-center gap-4.5 w-full justify-center">
                {/* Minimal breathing pace indicator */}
                <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-accent-purple/20 bg-accent-purple/10 transition-transform duration-1000 ease-in-out"
                  style={{
                    transform: breathTime < 5 ? `scale(${1 + (breathTime / 5) * 0.18})` : breathTime < 7 ? 'scale(1.18)' : `scale(${1.18 - ((breathTime - 7) / 5) * 0.36})`
                  }}
                >
                  <div className="h-4.5 w-4.5 rounded-full bg-accent-purple/40" />
                </div>

                <div className="flex flex-col select-none max-w-[170px]">
                  <span className="text-xs font-bold tracking-wide text-accent-purple uppercase">
                    {breathTime < 5 ? 'Inhale 🌬️' : breathTime < 7 ? 'Hold 🧘' : 'Exhale 💨'}
                  </span>
                  <span className="text-[9.5px] text-white/50 mt-1 leading-normal font-medium">
                    Cohere respiration pacing to optimize stress control.
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Coherence Informational Card (Active during Study) */}
        {timerMode === 'study' && (
          <div className="border border-white/5 bg-white/[0.02] rounded-[28px] p-4.5 select-none shadow-2xl backdrop-blur-3xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-bold tracking-wider text-white/40 uppercase bg-white/5 border border-white/5 px-2 py-0.5 rounded-full">Resonance Metrics</span>
              <div className="flex items-center gap-1.5 text-accent-purple">
                <Heart className="h-3.5 w-3.5" />
                <span className="text-[8.5px] font-bold uppercase tracking-wider">Cardiac Coherence</span>
              </div>
            </div>
            <div className="bg-black/20 border border-white/5 px-3.5 py-3 rounded-[20px]">
              <p className="text-xs font-bold text-white/90">Autonomic Stabilization</p>
              <p className="text-[10px] text-white/50 leading-relaxed mt-1">Deep, periodic breathing coordinates heartbeat rhythm to down-regulate pressure and maximize focus capacity.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
