import React, { useState } from 'react'
import type { PendingSessionData } from '../types/app'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { Button } from './shared/Button'
import { ModalShell } from './shared/ModalShell'

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
  const trapRef = useFocusTrap(showReflectionModal && !!pendingSessionData)

  if (!showReflectionModal || !pendingSessionData) return null

  const elapsed = adjustedElapsed !== null ? adjustedElapsed : pendingSessionData.elapsed
  const durationMinutes = Math.floor(elapsed / 60) || 1
  const standardBlockSeconds = studyBlockDurationMinutes * 60

  return (
    <ModalShell
      open
      ariaLabelledby="reflection-modal-title"
      ariaDescribedby="reflection-modal-desc"
      trapRef={trapRef}
      panelClassName="max-w-md rounded-[28px] p-7 animate-slide-in-up"
    >
      <div className="mb-4 pb-2 border-b border-white/10">
        <h3 id="reflection-modal-title" className="text-base font-semibold text-white">Session reflection</h3>
        <p id="reflection-modal-desc" className="text-caption text-white/50 mt-1">Rate how the session went before saving it to your log.</p>
      </div>

      <div className="space-y-6">
        {durationMinutes > 240 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-caption leading-relaxed text-accent-amber animate-fade-in flex flex-col gap-2">
            <span className="font-bold">Long session detected</span>
            <span>
              This session was <strong>{durationMinutes} minutes</strong>. You can keep it or adjust to a standard {studyBlockDurationMinutes}-minute block.
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAdjustedElapsed(standardBlockSeconds)}
              className="self-start"
            >
              Adjust to {studyBlockDurationMinutes} mins
            </Button>
          </div>
        )}

        <div>
          <label className="block text-caption font-bold text-white/70 uppercase tracking-wide mb-2.5">How focused were you?</label>
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
          <div className="flex justify-between text-label text-white/40 mt-1.5 font-bold">
            <span>Distracted</span>
            <span>In flow</span>
          </div>
        </div>

        <div>
          <label className="block text-caption font-bold text-white/70 uppercase tracking-wide mb-2.5">How stable was your focus?</label>
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
          <div className="flex justify-between text-label text-white/40 mt-1.5 font-bold">
            <span>Fragmented</span>
            <span>Steady</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-caption font-bold text-white/70 uppercase tracking-wide">Session notes</label>
            <span className={`text-label font-bold font-mono px-2 py-0.5 rounded-full ${localSessionNotes.length > 450 ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse' : 'text-white/40'}`}>
              {localSessionNotes.length} / 500
            </span>
          </div>
          <textarea
            value={localSessionNotes}
            onChange={e => setLocalSessionNotes(e.target.value.slice(0, 500))}
            maxLength={500}
            placeholder="What did you work on? Any wins or blockers?"
            className={`w-full h-16 rounded-2xl border bg-white/4 px-4 py-3 text-xs text-white outline-none focus:bg-white/8 placeholder-white/25 resize-none font-sans transition-all duration-300 ${localSessionNotes.length >= 500 ? 'border-red-500/40 focus:border-red-500/60' : 'border-white/8 focus:border-accent-blue/30'}`}
          />
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => onSubmitReflection(attentionRating, stabilityRating, localSessionNotes, elapsed)}
          className="w-full py-3.5"
        >
          Save session
        </Button>
      </div>
    </ModalShell>
  )
}
