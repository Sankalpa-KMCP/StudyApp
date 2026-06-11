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
  onSkipReflection: (customElapsed?: number) => void
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
  onSkipReflection,
}) => {
  const [adjustedElapsed, setAdjustedElapsed] = useState<number | null>(null)
  const isOpen = showReflectionModal && !!pendingSessionData
  const elapsed = adjustedElapsed !== null ? adjustedElapsed : (pendingSessionData?.elapsed ?? 0)

  const handleSkip = () => onSkipReflection(elapsed)
  const trapRef = useFocusTrap(isOpen, handleSkip)

  if (!isOpen || !pendingSessionData) return null

  const durationMinutes = Math.floor(elapsed / 60) || 1
  const standardBlockSeconds = studyBlockDurationMinutes * 60

  return (
    <ModalShell
      open
      onClose={handleSkip}
      ariaLabelledby="reflection-modal-title"
      ariaDescribedby="reflection-modal-desc"
      trapRef={trapRef}
      panelClassName="max-w-md rounded-[28px] p-7 pb-0 sm:pb-7 animate-slide-in-up flex flex-col max-h-[90vh]"
    >
      <div className="mb-4 pb-2 border-b border-white/10 shrink-0">
        <h3 id="reflection-modal-title" className="text-base font-semibold text-heading-primary">Session reflection</h3>
        <p id="reflection-modal-desc" className="text-caption text-muted mt-1">Rate how the session went before saving it to your log.</p>
      </div>

      <div className="space-y-6 overflow-y-auto flex-1 pb-4 sm:pb-0">
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

        <fieldset>
          <legend className="block text-caption font-bold text-muted uppercase tracking-wide mb-2.5">How focused were you?</legend>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(rating => (
              <button
                key={rating}
                type="button"
                onClick={() => setAttentionRating(rating)}
                aria-pressed={attentionRating === rating}
                className={`aspect-square flex-1 flex items-center justify-center text-xs font-bold transition-all duration-200 rounded-full cursor-pointer ios-active-scale border ${attentionRating === rating ? 'bg-accent-blue text-white border-accent-blue/30 shadow-md shadow-accent-blue/15' : 'bg-white/5 text-muted border-white/8 hover:bg-white/10 hover:text-heading-primary'}`}
              >
                {rating}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-label text-muted mt-1.5 font-bold">
            <span>Distracted</span>
            <span>In flow</span>
          </div>
        </fieldset>

        <fieldset>
          <legend className="block text-caption font-bold text-muted uppercase tracking-wide mb-2.5">How stable was your focus?</legend>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(rating => (
              <button
                key={rating}
                type="button"
                onClick={() => setStabilityRating(rating)}
                aria-pressed={stabilityRating === rating}
                className={`aspect-square flex-1 flex items-center justify-center text-xs font-bold transition-all duration-200 rounded-full cursor-pointer ios-active-scale border ${stabilityRating === rating ? 'bg-accent-blue text-white border-accent-blue/30 shadow-md shadow-accent-blue/15' : 'bg-white/5 text-muted border-white/8 hover:bg-white/10 hover:text-heading-primary'}`}
              >
                {rating}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-label text-muted mt-1.5 font-bold">
            <span>Fragmented</span>
            <span>Steady</span>
          </div>
        </fieldset>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="reflection-session-notes" className="block text-caption font-bold text-muted uppercase tracking-wide">Session notes</label>
            <span className={`text-label font-bold font-mono px-2 py-0.5 rounded-full ${localSessionNotes.length > 450 ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse' : 'text-muted'}`}>
              {localSessionNotes.length} / 500
            </span>
          </div>
          <textarea
            id="reflection-session-notes"
            value={localSessionNotes}
            onChange={e => setLocalSessionNotes(e.target.value.slice(0, 500))}
            maxLength={500}
            placeholder="What did you work on? Any wins or blockers?"
            className={`w-full h-16 rounded-2xl border bg-white/4 px-4 py-3 text-xs text-heading-primary outline-none focus:bg-white/8 placeholder-white/25 resize-none font-sans transition-all duration-300 ${localSessionNotes.length >= 500 ? 'border-red-500/40 focus:border-red-500/60' : 'border-white/8 focus:border-accent-blue/30'}`}
          />
        </div>
      </div>

      <div className="sticky bottom-0 -mx-7 px-7 py-4 mt-2 border-t border-white/10 bg-surface-elevated/95 backdrop-blur-md flex flex-col gap-2 sm:static sm:border-0 sm:bg-transparent sm:backdrop-blur-none sm:p-0 sm:mx-0 shrink-0">
        <Button
          variant="primary"
          size="md"
          onClick={() => onSubmitReflection(attentionRating, stabilityRating, localSessionNotes, elapsed)}
          className="w-full py-3.5"
        >
          Save & continue
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={handleSkip}
          className="w-full py-3"
        >
          Skip reflection
        </Button>
      </div>
    </ModalShell>
  )
}
