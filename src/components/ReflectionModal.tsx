import React from 'react'

interface ReflectionModalProps {
  showReflectionModal: boolean
  pendingSessionData: any
  attentionRating: number
  setAttentionRating: (rating: number) => void
  stabilityRating: number
  setStabilityRating: (rating: number) => void
  localSessionNotes: string
  setLocalSessionNotes: (notes: string) => void
  onSubmitReflection: (attention: number, stability: number, notes: string) => void
}

export const ReflectionModal: React.FC<ReflectionModalProps> = ({
  showReflectionModal,
  pendingSessionData,
  attentionRating,
  setAttentionRating,
  stabilityRating,
  setStabilityRating,
  localSessionNotes,
  setLocalSessionNotes,
  onSubmitReflection
}) => {
  if (!showReflectionModal || !pendingSessionData) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <div className="relative w-full max-w-md border border-white/10 bg-white/5 backdrop-blur-2xl rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4),_inset_0_1px_1px_rgba(255,255,255,0.08)] animate-slide-in-up animate-duration-300">
        <div className="mb-4 pb-2 border-b border-white/10">
          <h3 className="text-sm font-serif-luxury italic font-medium tracking-wider text-white">FLOW SESSION REFLECTION</h3>
          <p className="text-[10px] text-white/50 font-mono mt-1">Telemetry validation required for interval log archiving</p>
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase tracking-wide mb-2.5 font-mono">1. Internal Attention Focus</label>
            <div className="flex gap-2.5">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  onClick={() => setAttentionRating(rating)}
                  className={`flex-1 py-2 text-xs font-semibold border transition-all duration-300 ease-out rounded-xl cursor-pointer ${attentionRating === rating ? 'bg-white/15 text-white border-white/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' : 'bg-white/5 text-white/60 border-white/5 hover:border-white/10 hover:text-white'}`}
                >
                  {rating}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-white/40 mt-1 font-semibold">
              <span>Highly Distracted</span>
              <span>Flow State</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase tracking-wide mb-2.5 font-mono">2. Context-Switching Stability</label>
            <div className="flex gap-2.5">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  onClick={() => setStabilityRating(rating)}
                  className={`flex-1 py-2 text-xs font-semibold border transition-all duration-300 ease-out rounded-xl cursor-pointer ${stabilityRating === rating ? 'bg-white/15 text-white border-white/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' : 'bg-white/5 text-white/60 border-white/5 hover:border-white/10 hover:text-white'}`}
                >
                  {rating}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-white/40 mt-1 font-semibold">
              <span>Erratic/Fragmented</span>
              <span>Highly Resolute</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase tracking-wide mb-2 font-mono">3. Session Intention Summary</label>
            <textarea
              value={localSessionNotes}
              onChange={e => setLocalSessionNotes(e.target.value)}
              placeholder="Capture the essence of this session in a single sentence..."
              className="w-full h-16 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white outline-none focus:border-white/20 placeholder-white/30 resize-none font-sans transition-all duration-300"
            />
          </div>

          <button
            onClick={() => onSubmitReflection(attentionRating, stabilityRating, localSessionNotes)}
            className="w-full py-3 text-xs font-bold uppercase tracking-widest bg-white/15 text-white border border-white/20 hover:bg-white/20 transition-all duration-300 ease-out rounded-xl cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
          >
            Log Workstation Telemetry
          </button>
        </div>
      </div>
    </div>
  )
}
