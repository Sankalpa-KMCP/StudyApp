import React, { useState } from 'react'
import type { PendingSessionData } from '../types/app'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useTranslation } from '../i18n/useTranslation'
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
  const { t } = useTranslation()
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
      <div className="mb-4 pb-2 border-b border-card shrink-0">
        <h3 id="reflection-modal-title" className="text-base font-semibold text-heading-primary">{t('reflectionModalTitle')}</h3>
        <p id="reflection-modal-desc" className="text-caption text-muted mt-1">{t('reflectionModalDesc')}</p>
      </div>

      <div className="space-y-6 overflow-y-auto flex-1 pb-4 sm:pb-0">
        {durationMinutes > 240 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-caption leading-relaxed text-accent-amber animate-fade-in flex flex-col gap-2">
            <span className="font-bold">{t('reflectionLongSessionTitle')}</span>
            <span>
              {t('reflectionLongSessionBody', { minutes: durationMinutes, blockMinutes: studyBlockDurationMinutes })}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAdjustedElapsed(standardBlockSeconds)}
              className="self-start"
            >
              {t('reflectionAdjustToBlock', { blockMinutes: studyBlockDurationMinutes })}
            </Button>
          </div>
        )}

        <fieldset>
          <legend className="block text-caption font-bold text-muted uppercase tracking-wide mb-2.5">{t('reflectionAttentionLegend')}</legend>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(rating => (
              <button
                key={rating}
                type="button"
                onClick={() => setAttentionRating(rating)}
                aria-pressed={attentionRating === rating}
                className={`aspect-square flex-1 flex items-center justify-center text-xs font-bold transition-all duration-200 rounded-full cursor-pointer ios-active-scale border ${attentionRating === rating ? 'bg-accent-blue text-on-accent border-accent-blue/30 shadow-md shadow-accent-blue/15' : 'surface-subtle text-muted border-card hover:surface-track hover:text-heading-primary'}`}
              >
                {rating}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-label text-muted mt-1.5 font-bold">
            <span>{t('reflectionAttentionLow')}</span>
            <span>{t('reflectionAttentionHigh')}</span>
          </div>
        </fieldset>

        <fieldset>
          <legend className="block text-caption font-bold text-muted uppercase tracking-wide mb-2.5">{t('reflectionStabilityLegend')}</legend>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(rating => (
              <button
                key={rating}
                type="button"
                onClick={() => setStabilityRating(rating)}
                aria-pressed={stabilityRating === rating}
                className={`aspect-square flex-1 flex items-center justify-center text-xs font-bold transition-all duration-200 rounded-full cursor-pointer ios-active-scale border ${stabilityRating === rating ? 'bg-accent-blue text-on-accent border-accent-blue/30 shadow-md shadow-accent-blue/15' : 'surface-subtle text-muted border-card hover:surface-track hover:text-heading-primary'}`}
              >
                {rating}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-label text-muted mt-1.5 font-bold">
            <span>{t('reflectionStabilityLow')}</span>
            <span>{t('reflectionStabilityHigh')}</span>
          </div>
        </fieldset>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="reflection-session-notes" className="block text-caption font-bold text-muted uppercase tracking-wide">{t('reflectionSessionNotes')}</label>
            <span className={`text-label font-bold font-mono px-2 py-0.5 rounded-full ${localSessionNotes.length > 450 ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse' : 'text-muted'}`}>
              {localSessionNotes.length} / 500
            </span>
          </div>
          <textarea
            id="reflection-session-notes"
            value={localSessionNotes}
            onChange={e => setLocalSessionNotes(e.target.value.slice(0, 500))}
            maxLength={500}
            placeholder={t('reflectionSessionNotesPlaceholder')}
            className={`w-full h-16 rounded-2xl border surface-subtle px-4 py-3 text-xs text-heading-primary outline-none focus:surface-track placeholder:text-muted resize-none font-sans transition-all duration-300 ${localSessionNotes.length >= 500 ? 'border-red-500/40 focus:border-red-500/60' : 'border-card focus:border-accent-blue/30'}`}
          />
        </div>
      </div>

      <div className="sticky bottom-0 -mx-7 px-7 py-4 mt-2 border-t border-card surface-overlay backdrop-blur-md flex flex-col gap-2 sm:static sm:border-0 sm:bg-transparent sm:backdrop-blur-none sm:p-0 sm:mx-0 shrink-0">
        <Button
          variant="primary"
          size="md"
          onClick={() => onSubmitReflection(attentionRating, stabilityRating, localSessionNotes, elapsed)}
          className="w-full py-3.5"
        >
          {t('reflectionSaveContinue')}
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={handleSkip}
          className="w-full py-3"
        >
          {t('reflectionSkip')}
        </Button>
      </div>
    </ModalShell>
  )
}
