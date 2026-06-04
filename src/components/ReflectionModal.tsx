import React, { useState } from 'react'
import type { PendingSessionData } from '../types/app'

interface ReflectionModalProps {
  showReflectionModal: boolean
  pendingSessionData: PendingSessionData | null
  studyBlockDurationMinutes: number
  attentionRating: number
  setAttentionRating: (rating: number) => void
  stabilityRating: number
  setStabilityRating: (rating: number) => void
  localSessionNotes: string
  setLocalSessionNotes: (notes: string) => void
  onSubmitReflection: (attention: number, stability: number, notes: string, customElapsed?: number) => void
}

export const ReflectionModal: React.FC<ReflectionModalProps> = ({
  showReflectionModal,
  pendingSessionData,
  studyBlockDurationMinutes,
  attentionRating,
  setAttentionRating,
  stabilityRating,
  setStabilityRating,
  localSessionNotes,
  setLocalSessionNotes,
  onSubmitReflection,
}) => {
  const [adjustedElapsed, setAdjustedElapsed] = useState<number | null>(null)

  if (!showReflectionModal || !pendingSessionData) return null

  const elapsed = adjustedElapsed !== null ? adjustedElapsed : pendingSessionData.elapsed
  const durationMinutes = Math.floor(elapsed / 60) || 1
  const standardBlockSeconds = studyBlockDurationMinutes * 60

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="reflection-modal-title">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-xl" />
      <div key={pendingSessionData.timestamp} className="relative w-full max-w-md border border-white/10 bg-[#161620]/45 backdrop-blur-3xl rounded-[28px] p-7 shadow-[0_24px_60px_rgba(0,0,0,0.5),_inset_0_1px_1px_rgba(255,255,255,0.1)] animate-slide-in-up">
        <div className="mb-4 pb-2 border-b border-white/10">
          <h3 id="reflection-modal-title" className="text-sm font-serif-luxury italic font-medium tracking-wider text-white">FLOW SESSION REFLECTION</h3>
          <p className="text-[10px] text-white/50 font-mono mt-1">Telemetry validation required for interval log archiving</p>
        </div>

        <div className="space-y-6">
          {durationMinutes > 240 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs leading-relaxed text-accent-amber animate-fade-in flex flex-col gap-2">
              <span className="font-bold flex items-center gap-1">Duration Threshold Alert</span>
              <span>
                This session registered as <strong>{durationMinutes} minutes</strong> (exceeding 4 hours). To avoid logging an anomaly, you can validate it or reset to a standard {studyBlockDurationMinutes}-minute cycle.
              </span>
              <button
                type="button"
                onClick={() => setAdjustedElapsed(standardBlockSeconds)}
                className="px-3.5 py-1.5 rounded-xl bg-accent-amber/20 hover:bg-accent-amber/30 text-white text-[10px] font-bold text-center self-start transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-amber"
              >
                Adjust to {studyBlockDurationMinutes} mins
              </button>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-white/70 uppercase tracking-wide mb-2.5">1. Internal Attention Focus</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setAttentionRating(rating)}
                  aria-pressed={attentionRating === rating}
                  className={`aspect-square flex-1 flex items-center justify-center text-xs font-bold transition-all duration-200 rounded-full cursor-pointer ios-active-scale border ${attentionRating === rating ? 'bg-accent-blue text-white border-accent-blue/30 shadow-md shadow-accent-blue/15' : 'bg-white/5 text-white/60 border-white/8 hover:bg-white/10 hover:text-white'}`}
                >
                  {rating}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-white/40 mt-1.5 font-bold">
              <span>Highly Distracted</span>
              <span>Flow State</span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-white/70 uppercase tracking-wide mb-2.5">2. Context-Switching Stability</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setStabilityRating(rating)}
                  aria-pressed={stabilityRating === rating}
                  className={`aspect-square flex-1 flex items-center justify-center text-xs font-bold transition-all duration-200 rounded-full cursor-pointer ios-active-scale border ${stabilityRating === rating ? 'bg-accent-blue text-white border-accent-blue/30 shadow-md shadow-accent-blue/15' : 'bg-white/5 text-white/60 border-white/8 hover:bg-white/10 hover:text-white'}`}
                >
                  {rating}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-white/40 mt-1.5 font-bold">
              <span>Erratic/Fragmented</span>
              <span>Highly Resolute</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-[10px] font-bold text-white/70 uppercase tracking-wide">3. Session Intention Summary</label>
              <span className={`text-[8px] font-bold font-mono px-2 py-0.5 rounded-full ${localSessionNotes.length > 450 ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse' : 'text-white/40'}`}>
                {localSessionNotes.length} / 500
              </span>
            </div>
            <textarea
              value={localSessionNotes}
              onChange={e => setLocalSessionNotes(e.target.value.slice(0, 500))}
              maxLength={500}
              placeholder="Capture the essence of this session in a single sentence..."
              className={`w-full h-16 rounded-2xl border bg-white/4 px-4 py-3 text-xs text-white outline-none focus:bg-white/8 placeholder-white/25 resize-none font-sans transition-all duration-300 ${localSessionNotes.length >= 500 ? 'border-red-500/40 focus:border-red-500/60' : 'border-white/8 focus:border-accent-blue/30'}`}
            />
          </div>

          <button
            type="button"
            onClick={() => onSubmitReflection(attentionRating, stabilityRating, localSessionNotes, elapsed)}
            className="w-full py-3.5 text-xs font-semibold tracking-wide bg-accent-blue text-white hover:bg-accent-blue/90 border border-white/10 transition-all duration-200 rounded-full cursor-pointer shadow-md ios-active-scale focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Log Workstation Telemetry
          </button>
        </div>
      </div>
    </div>
  )
}
