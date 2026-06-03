import React from 'react'
import { Play, Pause, Check, CloudRain, Coffee, Radio, Brain, Sparkles } from 'lucide-react'

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
  setIsZenMode,
  noiseType,
  binauralTarget,
  updateSetting,
  localVolumeRain,
  setLocalVolumeRain,
  localVolumeCafe,
  setLocalVolumeCafe,
  localVolumeWhiteNoise,
  setLocalVolumeWhiteNoise,
  localAlphaWaves,
  setLocalAlphaWaves
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-1 items-start animate-fade-in">
      
      {/* Left block (Clock & Soundscapes) */}
      <div className="lg:col-span-12 flex flex-col gap-6">
        <div className="relative overflow-hidden flex flex-col border border-white/[0.06] dynamic-card p-6">
          <div className="flex items-center justify-between mb-6">
            <span className="font-serif-luxury italic tracking-wide text-white/80 text-xs uppercase">01 / CHRONOS ENGINE</span>
            <button
              onClick={() => setIsZenMode(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-medium border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 transition-all duration-300 ease-out cursor-pointer"
            >
              <Sparkles className="h-3 w-3" />
              <span>Sanctuary Mode (Z)</span>
            </button>
          </div>

          {/* Timer Dial Display */}
          <div className="flex flex-col items-center py-4 border-b border-white/5">
            <div className="relative flex h-44 w-44 items-center justify-center">
              <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
                <circle
                  cx="60" cy="60" r="52"
                  fill="none" stroke="var(--color-accent-blue)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray="326.7"
                  strokeDashoffset={String(326.7 * (1 - progress))}
                  style={{
                    stroke: timerMode === 'study' ? 'var(--color-accent-blue)' : isLongBreak ? 'var(--color-accent-green)' : 'var(--color-accent-amber)',
                    transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s',
                    filter: `drop-shadow(0 0 8px ${timerMode === 'study' ? 'var(--color-accent-blue)' : isLongBreak ? 'var(--color-accent-green)' : 'var(--color-accent-amber)'}40)`
                  }}
                />
              </svg>
              <div className="text-center z-10">
                <p className="text-4xl font-extralight text-white font-mono tracking-tight tabular-nums select-none drop-shadow-[0_2px_12px_rgba(255,255,255,0.05)]">
                  {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:{String(remainingSeconds % 60).padStart(2, '0')}
                </p>
                <p className="text-[10px] text-white/60 font-semibold uppercase tracking-wider mt-1 select-none">
                  {timerMode === 'study' ? 'Study Block' : isLongBreak ? 'Long Break' : 'Short Break'}
                </p>
              </div>
            </div>

            {/* Quick Controls */}
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => handleModeSwitch(timerMode === 'study' ? 'break' : 'study')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 transition-all duration-300 ease-out cursor-pointer"
              >
                Switch to {timerMode === 'study' ? 'Break' : 'Study'}
              </button>
              
              <button
                onClick={() => setIsTimerActive(a => !a)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/15 transition-all duration-300 ease-out active:scale-95 cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
              >
                {isTimerActive ? <Pause className="h-4.5 w-4.5" /> : <Play className="h-4.5 w-4.5" />}
              </button>

              {(isTimerActive || secondsElapsed > 0) && (
                <button
                  onClick={completeSession}
                  className="flex items-center gap-1.5 rounded-xl bg-white/20 text-white border border-white/30 px-3.5 py-1.5 text-xs font-medium transition-all duration-300 ease-out hover:bg-white/25 active:scale-95 cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                >
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Complete</span>
                </button>
              )}
            </div>

            {/* Progress Tracker */}
            <div className="flex items-center gap-2 mt-4 text-[10px] text-slate-400 font-semibold bg-white/[0.02] border border-white/5 px-3 py-1 rounded-full">
              <span>Cycle:</span>
              <div className="flex items-center gap-1" title={`${completedSessionsInCycle} of ${targetSessionsPerCycle} completed`}>
                {Array.from({ length: targetSessionsPerCycle }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                      i < completedSessionsInCycle
                        ? 'bg-accent-blue scale-125 shadow-[0_0_4px_var(--color-accent-blue)]'
                        : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Guided HRV Coherence Breath Pacer (Active during Break) */}
          {timerMode !== 'study' && (
            <div className="mt-5 border border-white/[0.04] bg-white/[0.02] rounded-2xl p-4 flex flex-col items-center gap-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] transition-all duration-500 animate-slide-in-up">
              <div className="flex justify-between w-full text-[10px] text-white/50 tracking-wider uppercase font-semibold">
                <span>Guided HRV Breathing</span>
                <span className="text-[9px] text-accent-blue tracking-widest animate-pulse font-mono">Coherence Active</span>
              </div>
              
              <div className="flex items-center gap-4 py-2 w-full justify-center">
                {/* Animated Breathing Circle */}
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-1000 ease-in-out"
                  style={{
                    transform: breathTime < 5 ? `scale(${1 + (breathTime / 5) * 0.2})` : breathTime < 7 ? 'scale(1.2)' : `scale(${1.2 - ((breathTime - 7) / 5) * 0.4})`,
                    borderColor: breathTime < 5 ? 'rgba(255,255,255,0.15)' : breathTime < 7 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)',
                    backgroundColor: breathTime < 5 ? 'rgba(255,255,255,0.02)' : breathTime < 7 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div className="h-6 w-6 rounded-full bg-white/20 blur-sm animate-pulse" />
                </div>

                <div className="flex flex-col">
                  <span className="text-xs font-mono font-bold tracking-widest text-white uppercase">
                    {breathTime < 5 ? 'Inhale 💨' : breathTime < 7 ? 'Hold 🧘' : 'Exhale 🌬️'}
                  </span>
                  <span className="text-[9px] text-white/40 font-semibold mt-0.5">
                    Regulate heart-rate coherence
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Ambient Controls */}
          <div className="mt-5 space-y-3">
            <p className="text-[10px] font-semibold text-white/60 tracking-wider uppercase">Background Ambience</p>
            <div className="flex flex-col gap-2">
              
              {/* Rain Slider */}
              <div className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2 transition-all duration-300 ease-out">
                <CloudRain className="h-3.5 w-3.5 text-white/60 shrink-0" />
                <span className="text-xs font-medium text-white/80 w-24 shrink-0">Rain</span>
                <div className="w-8 h-3 flex items-end justify-center shrink-0">
                  {localVolumeRain > 0 && (
                    <div className="flex items-end gap-[2px] h-3 w-5">
                      <span className="w-[2px] bg-white/50 rounded-full animate-wave-bar-1" style={{ animationDuration: '0.8s' }} />
                      <span className="w-[2px] bg-white/50 rounded-full animate-wave-bar-2" style={{ animationDuration: '0.5s' }} />
                      <span className="w-[2px] bg-white/50 rounded-full animate-wave-bar-3" style={{ animationDuration: '0.7s' }} />
                      <span className="w-[2px] bg-white/50 rounded-full animate-wave-bar-4" style={{ animationDuration: '0.6s' }} />
                    </div>
                  )}
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={localVolumeRain}
                  onChange={e => {
                    const v = parseFloat(e.target.value)
                    setLocalVolumeRain(v)
                    updateSetting('ambientVolume_rain', v)
                  }}
                  className="flex-1 h-1 rounded-full cursor-pointer bg-white/10 outline-none accent-white"
                />
                <span className="text-[10px] font-semibold text-white/60 w-7 text-right font-mono">
                  {Math.round(localVolumeRain * 100)}%
                </span>
              </div>

              {/* Cafe Slider */}
              <div className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2 transition-all duration-300 ease-out">
                <Coffee className="h-3.5 w-3.5 text-white/60 shrink-0" />
                <span className="text-xs font-medium text-white/80 w-24 shrink-0">Cafe Ambient</span>
                <div className="w-8 h-3 flex items-end justify-center shrink-0">
                  {localVolumeCafe > 0 && (
                    <div className="flex items-end gap-[2px] h-3 w-5">
                      <span className="w-[2px] bg-white/50 rounded-full animate-wave-bar-1" style={{ animationDuration: '0.8s' }} />
                      <span className="w-[2px] bg-white/50 rounded-full animate-wave-bar-2" style={{ animationDuration: '0.5s' }} />
                      <span className="w-[2px] bg-white/50 rounded-full animate-wave-bar-3" style={{ animationDuration: '0.7s' }} />
                      <span className="w-[2px] bg-white/50 rounded-full animate-wave-bar-4" style={{ animationDuration: '0.6s' }} />
                    </div>
                  )}
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={localVolumeCafe}
                  onChange={e => {
                    const v = parseFloat(e.target.value)
                    setLocalVolumeCafe(v)
                    updateSetting('ambientVolume_cafe', v)
                  }}
                  className="flex-1 h-1 rounded-full cursor-pointer bg-white/10 outline-none accent-white"
                />
                <span className="text-[10px] font-semibold text-white/60 w-7 text-right font-mono">
                  {Math.round(localVolumeCafe * 100)}%
                </span>
              </div>

              {/* Procedural Noise Slider & Type Selector */}
              <div className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2 transition-all duration-300 ease-out">
                <Radio className="h-3.5 w-3.5 text-white/60 shrink-0" />
                <div className="flex flex-col w-24 shrink-0">
                  <span className="text-xs font-medium text-white/80">Noise Color</span>
                  <select
                    value={noiseType}
                    onChange={e => updateSetting('noiseType', e.target.value)}
                    className="text-[9px] font-semibold tracking-wider font-mono text-white/50 bg-[#0c0f17]/65 border border-white/5 rounded px-1.5 py-0.5 mt-0.5 outline-none cursor-pointer hover:bg-[#121824] transition-all"
                  >
                    <option value="white">White</option>
                    <option value="pink">Pink</option>
                    <option value="brown">Brown</option>
                  </select>
                </div>
                <div className="w-8 h-3 flex items-end justify-center shrink-0">
                  {localVolumeWhiteNoise > 0 && (
                    <div className="flex items-end gap-[2px] h-3 w-5">
                      <span className="w-[2px] bg-white/50 rounded-full animate-wave-bar-1" style={{ animationDuration: '0.8s' }} />
                      <span className="w-[2px] bg-white/50 rounded-full animate-wave-bar-2" style={{ animationDuration: '0.5s' }} />
                      <span className="w-[2px] bg-white/50 rounded-full animate-wave-bar-3" style={{ animationDuration: '0.7s' }} />
                      <span className="w-[2px] bg-white/50 rounded-full animate-wave-bar-4" style={{ animationDuration: '0.6s' }} />
                    </div>
                  )}
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={localVolumeWhiteNoise}
                  onChange={e => {
                    const v = parseFloat(e.target.value)
                    setLocalVolumeWhiteNoise(v)
                    updateSetting('ambientVolume_whiteNoise', v)
                  }}
                  className="flex-1 h-1 rounded-full cursor-pointer bg-white/10 outline-none accent-white"
                />
                <span className="text-[10px] font-semibold text-white/60 w-7 text-right font-mono">
                  {Math.round(localVolumeWhiteNoise * 100)}%
                </span>
              </div>

              {/* Binaural Beats Waves Slider & Target Selector */}
              <div className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2 transition-all duration-300 ease-out">
                <Brain className="h-3.5 w-3.5 text-white/60 shrink-0" />
                <div className="flex flex-col w-24 shrink-0">
                  <span className="text-xs font-medium text-white/80">Binaural Beat</span>
                  <select
                    value={binauralTarget}
                    onChange={e => updateSetting('binauralTarget', e.target.value)}
                    className="text-[9px] font-semibold tracking-wider font-mono text-white/50 bg-[#0c0f17]/65 border border-white/5 rounded px-1.5 py-0.5 mt-0.5 outline-none cursor-pointer hover:bg-[#121824] transition-all"
                  >
                    <option value="alpha">Alpha (10Hz)</option>
                    <option value="theta">Theta (6Hz)</option>
                    <option value="beta">Beta (16Hz)</option>
                  </select>
                </div>
                <div className="w-8 h-3 flex items-end justify-center shrink-0">
                  {localAlphaWaves > 0 && (
                    <div className="flex items-end gap-[2px] h-3 w-5">
                      <span className="w-[2px] bg-white/50 rounded-full animate-wave-bar-1" style={{ animationDuration: '0.8s' }} />
                      <span className="w-[2px] bg-white/50 rounded-full animate-wave-bar-2" style={{ animationDuration: '0.5s' }} />
                      <span className="w-[2px] bg-white/50 rounded-full animate-wave-bar-3" style={{ animationDuration: '0.7s' }} />
                      <span className="w-[2px] bg-white/50 rounded-full animate-wave-bar-4" style={{ animationDuration: '0.6s' }} />
                    </div>
                  )}
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={localAlphaWaves}
                  onChange={e => {
                    const v = parseFloat(e.target.value)
                    setLocalAlphaWaves(v)
                    updateSetting('ambient_alphaWaves', v)
                  }}
                  className="flex-1 h-1 rounded-full cursor-pointer bg-white/10 outline-none accent-white"
                />
                <span className="text-[10px] font-semibold text-white/60 w-7 text-right font-mono">
                  {Math.round(localAlphaWaves * 100)}%
                </span>
              </div>

            </div>
          </div>
        </div>

        {/* HRV Coherence Pacer Card */}
        <div className="border border-white/[0.06] dynamic-card p-5 animate-hrv-pacer">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-mono tracking-widest text-white/80 uppercase bg-white/5 px-2.5 py-0.5 rounded-xl border border-white/10">HRV Resonance</span>
            <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">8s Breathe</span>
          </div>
          <div className="flex items-center gap-4 bg-[#0c0f17]/40 border border-white/5 px-4 py-3 rounded-xl">
            <div className="relative flex h-10 w-10 items-center justify-center shrink-0">
              <div className="absolute inset-0 rounded-full border border-accent-purple/30 animate-zen-breath" />
              <div className="h-4 w-4 rounded-full bg-accent-purple animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-350 select-none">HRV Coherence Pacer</p>
              <p className="text-[10px] text-slate-505 leading-normal mt-0.5">Align respiration with the expanding shadow ring (4s inhale / 4s exhale) to optimize autonomic stability.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
