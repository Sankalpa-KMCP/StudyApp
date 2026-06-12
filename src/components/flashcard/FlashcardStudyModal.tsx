import { useCallback } from 'react'
import { X, Sparkles } from 'lucide-react'
import type { FlashcardItem } from '../../db/types'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useFlashcardStudyKeyboard } from '../../hooks/useFlashcardStudyKeyboard'
import { Button } from '../shared/Button'
import { SM2_HELPER } from '../../lib/shared/uxTerms'
import { SM2_GRADES } from './constants'

interface FlashcardStudyModalProps {
  isFlipped: boolean
  setIsFlipped: (fn: (f: boolean) => boolean) => void
  sessionCompleted: boolean
  cardsGradedCount: number
  studyQueue: FlashcardItem[]
  currentQueueIndex: number
  currentCard: FlashcardItem
  onClose: () => void
  onGrade: (grade: number) => void
}

export function FlashcardStudyModal({
  isFlipped,
  setIsFlipped,
  sessionCompleted,
  cardsGradedCount,
  studyQueue,
  currentQueueIndex,
  currentCard,
  onClose,
  onGrade,
}: FlashcardStudyModalProps) {
  const trapRef = useFocusTrap(true, onClose)

  const handleFlip = useCallback(() => setIsFlipped(f => !f), [setIsFlipped])

  useFlashcardStudyKeyboard({
    enabled: true,
    isFlipped,
    sessionCompleted,
    onFlip: handleFlip,
    onGrade,
    onClose,
  })

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Flashcard study session">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-md cursor-default"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div ref={trapRef} className="relative w-full max-w-lg flex flex-col items-center gap-6 z-10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close study mode"
          className="absolute -top-12 right-0 md:top-0 md:-right-12 h-10 w-10 flex items-center justify-center rounded-full bg-white/5 border border-white/8 text-white/70 hover:text-white hover:bg-white/10 cursor-pointer transition-all ios-active-scale shadow-md"
        >
          <X className="h-5 w-5" />
        </button>

        {!sessionCompleted && (
          <div className="text-center w-full max-w-md select-none animate-fade-in">
            <span className="text-label font-bold tracking-widest text-white/40 uppercase">Active Recall Practice</span>
            <h3 className="text-sm font-bold text-white mt-1">
              Card {currentQueueIndex + 1} of {studyQueue.length}
            </h3>
            <div className="h-1.5 w-full bg-white/5 border border-white/8 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-accent-blue transition-all duration-300"
                style={{ width: `${((currentQueueIndex + 1) / studyQueue.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {sessionCompleted ? (
          <div className="w-full max-w-md p-7 rounded-[32px] border border-white/10 bg-[#161620]/95 backdrop-blur-xl shadow-2xl flex flex-col items-center justify-center text-center animate-slide-in-up">
            <div className="h-12 w-12 rounded-full bg-accent-green/10 border border-accent-green/20 flex items-center justify-center mb-4 text-accent-green">
              <Sparkles className="h-6 w-6 text-accent-green" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Review complete</h3>
            <p className="text-caption text-white/50 mb-6 max-w-xs select-none">
              You reviewed {cardsGradedCount} flashcards. Next review dates have been updated.
            </p>
            <Button variant="primary" onClick={onClose}>
              Return to deck
            </Button>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-6 animate-slide-in-up">
            <div className="w-full aspect-[4/3] max-w-md flashcard-wrapper">
              <div
                role="button"
                tabIndex={0}
                aria-label={isFlipped ? 'Show question' : 'Reveal answer'}
                onClick={handleFlip}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleFlip()
                  }
                }}
                className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}
              >
                <div className="flashcard-front bg-[#161620]/95 border border-white/8 hover:bg-white/5 hover:border-white/15 transition-all shadow-2xl backdrop-blur-xl select-none">
                  <span className="text-label font-mono tracking-widest text-white/40 uppercase absolute top-5 select-none font-semibold">Question</span>
                  <p className="text-base md:text-lg font-bold text-white px-4 max-h-40 overflow-y-auto whitespace-pre-wrap select-none leading-relaxed">{currentCard.question}</p>
                  <span className="text-label font-mono text-white/30 absolute bottom-5 uppercase select-none tracking-widest font-bold">Tap to reveal</span>
                </div>
                <div className="flashcard-back bg-[#161620]/95 border border-accent-blue/20 hover:bg-white/5 hover:border-accent-blue/30 transition-all shadow-2xl backdrop-blur-xl select-none">
                  <span className="text-label font-mono tracking-widest text-accent-blue uppercase absolute top-5 select-none font-bold">Answer</span>
                  <p className="text-base md:text-lg font-bold text-white px-4 max-h-40 overflow-y-auto whitespace-pre-wrap select-none leading-relaxed">{currentCard.answer}</p>
                  <span className="text-label font-mono text-white/30 absolute bottom-5 uppercase select-none tracking-widest font-bold">Tap for question</span>
                </div>
              </div>
            </div>

            {!isFlipped && (
              <p className="text-caption text-center text-white/45 mb-2 select-none">
                Flip the card to reveal grade buttons
              </p>
            )}

            <div className={`w-full max-w-md transition-all duration-300 ${isFlipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
              <p className="text-caption font-mono text-center text-white/40 mb-1 select-none uppercase tracking-wider font-bold">Rate recall strength</p>
              <p className="text-micro text-center text-white/35 mb-3">{SM2_HELPER}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {SM2_GRADES.map(grade => (
                  <button
                    key={grade.value}
                    onClick={() => onGrade(grade.value)}
                    aria-label={`Recall grade ${grade.value} (${grade.label})`}
                    className={`min-h-11 p-3 rounded-[20px] border border-white/8 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-1 transition-all duration-200 ios-active-scale cursor-pointer ${grade.color}`}
                  >
                    <span className="text-sm font-bold">{grade.label}</span>
                    <span className="text-label font-bold tracking-tight uppercase leading-tight font-mono text-white/40">{grade.value}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
