import { X, Sparkles } from 'lucide-react'
import type { FlashcardItem } from '../../db/types'
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
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-3xl transition-all duration-500"
      style={{ background: 'radial-gradient(circle at 50% 0%, #17122b 0%, #080611 60%, #020105 100%)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Flashcard study session"
    >
      <div className="relative w-full max-w-lg flex flex-col items-center gap-6 z-10">
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 md:top-0 md:-right-12 h-10 w-10 flex items-center justify-center rounded-full bg-white/5 border border-white/8 text-white/70 hover:text-white hover:bg-white/10 cursor-pointer transition-all ios-active-scale shadow-md"
          title="Close Study Mode"
        >
          <X className="h-5 w-5" />
        </button>

        {!sessionCompleted && (
          <div className="text-center w-full max-w-md select-none animate-fade-in">
            <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Active Recall Practice</span>
            <h3 className="text-sm font-bold text-white mt-1">
              Card {currentQueueIndex + 1} of {studyQueue.length}
            </h3>
            <div className="h-1.5 w-full bg-white/5 border border-white/8 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-accent-blue transition-all duration-300"
                style={{ width: `${(currentQueueIndex / studyQueue.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {sessionCompleted ? (
          <div className="w-full max-w-md p-7 rounded-[32px] border border-white/10 bg-[#161620]/45 shadow-[0_24px_60px_rgba(0,0,0,0.4)] backdrop-blur-3xl flex flex-col items-center justify-center text-center animate-slide-in-up">
            <div className="h-12 w-12 rounded-full bg-accent-green/10 border border-accent-green/20 flex items-center justify-center mb-4 text-accent-green">
              <Sparkles className="h-6 w-6 text-accent-green" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-wide">Review Complete!</h3>
            <p className="text-xs text-white/50 mb-6 max-w-xs select-none">
              Excellent work. You completed reviews for {cardsGradedCount} flashcards. Spaced repetition dates have been rescheduled.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-full text-xs font-semibold bg-accent-blue text-white hover:bg-accent-blue/90 border border-white/10 transition-all cursor-pointer shadow-md ios-active-scale"
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-6 animate-slide-in-up">
            <div className="w-full aspect-[4/3] max-w-md flashcard-wrapper">
              <div onClick={() => setIsFlipped(f => !f)} className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
                <div className="flashcard-front bg-[#161620]/45 border border-white/8 hover:bg-white/5 hover:border-white/15 transition-all shadow-[0_24px_50px_rgba(0,0,0,0.35)] select-none">
                  <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase absolute top-5 select-none font-semibold">Question Prompt</span>
                  <p className="text-base md:text-lg font-bold text-white px-4 max-h-40 overflow-y-auto whitespace-pre-wrap select-none leading-relaxed">{currentCard.question}</p>
                  <span className="text-[9px] font-mono text-white/30 absolute bottom-5 uppercase select-none tracking-widest font-bold">Click to reveal answer</span>
                </div>
                <div className="flashcard-back bg-[#161620]/65 border border-accent-blue/20 hover:bg-white/5 hover:border-accent-blue/30 transition-all shadow-[0_24px_50px_rgba(0,0,0,0.35)] select-none">
                  <span className="text-[9px] font-mono tracking-widest text-accent-blue uppercase absolute top-5 select-none font-bold">Definition Answer</span>
                  <p className="text-base md:text-lg font-bold text-white px-4 max-h-40 overflow-y-auto whitespace-pre-wrap select-none leading-relaxed">{currentCard.answer}</p>
                  <span className="text-[9px] font-mono text-white/30 absolute bottom-5 uppercase select-none tracking-widest font-bold">Click to show question</span>
                </div>
              </div>
            </div>

            <div className={`w-full max-w-md transition-all duration-300 ${isFlipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
              <p className="text-[10px] font-mono text-center text-white/40 mb-3 select-none uppercase tracking-wider font-bold">Rate retrieval strength (SM-2):</p>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {SM2_GRADES.map(grade => (
                  <button
                    key={grade.value}
                    onClick={() => onGrade(grade.value)}
                    className={`p-3 rounded-[20px] border border-white/8 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-1 transition-all duration-200 ios-active-scale cursor-pointer ${grade.color}`}
                  >
                    <span className="text-sm font-bold font-mono">{grade.value}</span>
                    <span className="text-[8px] font-bold tracking-tight uppercase leading-tight font-mono">{grade.label}</span>
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
