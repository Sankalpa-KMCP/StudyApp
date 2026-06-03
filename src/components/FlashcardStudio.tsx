import React, { useState, useMemo } from 'react'
import { Layers, Plus, Trash2, X, GraduationCap, Calendar, Sparkles } from 'lucide-react'
import type { CategoryItem, FlashcardItem } from '../db/types'

interface FlashcardStudioProps {
  categories: CategoryItem[]
  flashcards: FlashcardItem[]
  addFlashcard: (question: string, answer: string, categoryId?: number) => Promise<void>
  deleteFlashcard: (id: number) => Promise<void>
  submitFlashcardGrade: (id: number, grade: number) => Promise<void>
}

export const FlashcardStudio: React.FC<FlashcardStudioProps> = ({
  categories,
  flashcards,
  addFlashcard,
  deleteFlashcard,
  submitFlashcardGrade
}) => {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | number>('all')
  const [newQuestion, setNewQuestion] = useState('')
  const [newAnswer, setNewAnswer] = useState('')
  const [newCategoryId, setNewCategoryId] = useState<number | undefined>(undefined)
  
  // Study session states
  const [isStudying, setIsStudying] = useState(false)
  const [studyQueue, setStudyQueue] = useState<FlashcardItem[]>([])
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [sessionCompleted, setSessionCompleted] = useState(false)
  const [cardsGradedCount, setCardsGradedCount] = useState(0)

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const isDue = (card: FlashcardItem) => {
    return !card.nextReviewDate || card.nextReviewDate <= todayStr
  }

  // Filtered flashcards list
  const filteredCards = useMemo(() => {
    if (activeCategoryFilter === 'all') return flashcards
    return flashcards.filter(c => c.categoryId === activeCategoryFilter)
  }, [flashcards, activeCategoryFilter])

  // Count metrics
  const stats = useMemo(() => {
    const total = filteredCards.length
    const due = filteredCards.filter(isDue).length
    const gradedCards = filteredCards.filter(c => c.latestGrade !== undefined)
    const avgGrade = gradedCards.length > 0
      ? parseFloat((gradedCards.reduce((acc, c) => acc + (c.latestGrade ?? 0), 0) / gradedCards.length).toFixed(1))
      : 0
    return { total, due, avgGrade }
  }, [filteredCards, todayStr])

  const categoriesMap = useMemo(() => {
    const map = new Map<number, { name: string; color: string }>()
    categories.forEach(c => {
      if (c.id !== undefined) map.set(c.id, c)
    })
    return map
  }, [categories])

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQuestion.trim() || !newAnswer.trim()) return
    await addFlashcard(newQuestion.trim(), newAnswer.trim(), newCategoryId)
    setNewQuestion('')
    setNewAnswer('')
  }

  const startStudy = (dueOnly: boolean) => {
    const queue = dueOnly
      ? filteredCards.filter(isDue)
      : [...filteredCards]
    
    if (queue.length === 0) return
    
    // Shuffle queue for better recall practice
    const shuffled = queue.sort(() => Math.random() - 0.5)
    setStudyQueue(shuffled)
    setCurrentQueueIndex(0)
    setIsFlipped(false)
    setSessionCompleted(false)
    setCardsGradedCount(0)
    setIsStudying(true)
  }

  const handleGrade = async (grade: number) => {
    const card = studyQueue[currentQueueIndex]
    if (card.id === undefined) return

    await submitFlashcardGrade(card.id, grade)
    setCardsGradedCount(prev => prev + 1)
    
    if (currentQueueIndex + 1 < studyQueue.length) {
      setIsFlipped(false)
      // Small timeout for smooth slide transition
      setTimeout(() => {
        setCurrentQueueIndex(prev => prev + 1)
      }, 200)
    } else {
      setSessionCompleted(true)
    }
  }

  const currentCard = studyQueue[currentQueueIndex]

  const grades = [
    { value: 0, label: 'Forgot', desc: 'Blackout', color: 'hover:bg-red-500/20 border-red-500/30 text-red-400' },
    { value: 1, label: 'Incorrect', desc: 'Wrong', color: 'hover:bg-orange-500/20 border-orange-500/30 text-orange-400' },
    { value: 2, label: 'Hard', desc: 'Barely', color: 'hover:bg-amber-500/20 border-amber-500/30 text-amber-300' },
    { value: 3, label: 'Good', desc: 'Effort', color: 'hover:bg-green-500/20 border-green-500/30 text-green-400' },
    { value: 4, label: 'Easy', desc: 'Correct', color: 'hover:bg-blue-500/20 border-blue-500/30 text-blue-400' },
    { value: 5, label: 'Perfect', desc: 'Instant', color: 'hover:bg-purple-500/20 border-purple-500/30 text-purple-400' },
  ]

  return (
    <div className="flex-1 flex flex-col min-h-0 animate-slide-in-up">
      {/* Title Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Layers className="h-5 w-5 text-accent-blue" />
            Active Recall Deck
          </h2>
          <p className="text-xs text-slate-400 mt-1 select-none">
            Utilize the SuperMemo-2 scheduler to systematically optimize cognitive retention.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              activeCategoryFilter === 'all'
                ? 'bg-white/10 text-white border-white/20'
                : 'bg-white/[0.02] text-white/60 border-white/5 hover:text-white'
            }`}
          >
            All Decks
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => cat.id !== undefined && setActiveCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
                activeCategoryFilter === cat.id
                  ? 'text-white border-white/20'
                  : 'bg-white/[0.02] text-white/60 border-white/5 hover:text-white'
              }`}
              style={activeCategoryFilter === cat.id ? { backgroundColor: `${cat.color}25`, borderColor: cat.color } : {}}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="dynamic-card p-4 flex flex-col justify-between">
          <span className="text-[9px] font-mono tracking-widest text-white/50 uppercase">Total Flashcards</span>
          <span className="text-2xl font-bold text-white mt-2 font-mono">{stats.total}</span>
        </div>
        <div className="dynamic-card p-4 flex flex-col justify-between">
          <span className="text-[9px] font-mono tracking-widest text-white/50 uppercase">Due For Review</span>
          <span className={`text-2xl font-bold mt-2 font-mono ${stats.due > 0 ? 'text-accent-amber' : 'text-accent-green'}`}>
            {stats.due}
          </span>
        </div>
        <div className="dynamic-card p-4 flex flex-col justify-between">
          <span className="text-[9px] font-mono tracking-widest text-white/50 uppercase">Average Recall Grade</span>
          <span className="text-2xl font-bold text-white mt-2 font-mono">{stats.avgGrade} <span className="text-xs text-white/40">/ 5.0</span></span>
        </div>
      </div>

      {/* Interactive Main Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 min-h-0">
        
        {/* Left Form Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="dynamic-card p-5">
            <h3 className="text-sm font-semibold mb-4 text-white">Create New Flashcard</h3>
            <form onSubmit={handleAddCard} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase text-white/50 mb-1.5 select-none">Question / Term</label>
                <textarea
                  required
                  rows={2}
                  value={newQuestion}
                  onChange={e => setNewQuestion(e.target.value)}
                  placeholder="Enter front side question..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs text-white placeholder-white/20 outline-none transition-all focus:border-white/20 focus:bg-white/[0.05]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-white/50 mb-1.5 select-none">Answer / Definition</label>
                <textarea
                  required
                  rows={3}
                  value={newAnswer}
                  onChange={e => setNewAnswer(e.target.value)}
                  placeholder="Enter back side answer detail..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs text-white placeholder-white/20 outline-none transition-all focus:border-white/20 focus:bg-white/[0.05]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-white/50 mb-1.5 select-none">Deck Category</label>
                <select
                  value={newCategoryId ?? ''}
                  onChange={e => setNewCategoryId(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs text-white outline-none transition-all focus:border-white/20 focus:bg-white/[0.05]"
                >
                  <option value="" className="bg-[#0b0c10] text-white/65">Uncategorized</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#0b0c10] text-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add to Deck
              </button>
            </form>
          </div>

          {/* Practice Action Panel */}
          <div className="dynamic-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Study Decks</h3>
            <p className="text-[11px] text-slate-400 select-none leading-relaxed">
              Reviewing cards periodically trains active recall. Shuffle is active by default.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => startStudy(true)}
                disabled={stats.due === 0}
                className={`py-3 rounded-xl text-xs font-semibold border flex flex-col items-center justify-center gap-1 transition-all ${
                  stats.due > 0
                    ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/30 hover:bg-accent-blue/25 cursor-pointer shadow-[0_0_15px_rgba(var(--color-accent-blue-rgb),0.1)]'
                    : 'bg-white/[0.02] text-white/30 border-white/5 cursor-not-allowed'
                }`}
              >
                <GraduationCap className="h-4.5 w-4.5" />
                <span>Study Due ({stats.due})</span>
              </button>
              <button
                onClick={() => startStudy(false)}
                disabled={stats.total === 0}
                className={`py-3 rounded-xl text-xs font-semibold border flex flex-col items-center justify-center gap-1 transition-all ${
                  stats.total > 0
                    ? 'bg-white/5 text-white border-white/10 hover:bg-white/10 cursor-pointer'
                    : 'bg-white/[0.02] text-white/30 border-white/5 cursor-not-allowed'
                }`}
              >
                <Layers className="h-4.5 w-4.5" />
                <span>Study All ({stats.total})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Cards List Grid */}
        <div className="lg:col-span-8 flex flex-col min-h-[450px] lg:h-[600px] dynamic-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-white">Flashcards Registry</h3>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
            {filteredCards.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                <Layers className="h-8 w-8 text-white/20 mb-3 animate-pulse" />
                <p className="text-xs text-white/40 select-none">No cards created yet in this deck.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCards.map(card => {
                  const cat = card.categoryId !== undefined ? categoriesMap.get(card.categoryId) : undefined
                  const isCardDue = isDue(card)
                  return (
                    <div
                      key={card.id}
                      className="group p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all flex flex-col justify-between gap-3 relative"
                    >
                      {/* Top Header info */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <span
                            className="inline-block text-[8px] font-bold tracking-wider font-mono uppercase px-2 py-0.5 rounded"
                            style={cat ? { backgroundColor: `${cat.color}18`, color: cat.color } : { backgroundColor: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}
                          >
                            {cat ? cat.name : 'Uncategorized'}
                          </span>
                          <p className="text-xs font-semibold text-white leading-normal pr-4 line-clamp-2">
                            {card.question}
                          </p>
                        </div>
                        <button
                          onClick={() => card.id !== undefined && deleteFlashcard(card.id)}
                          className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/5 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-white/5" />

                      {/* Answer Preview */}
                      <p className="text-[10px] text-slate-400 leading-normal line-clamp-2 italic">
                        {card.answer}
                      </p>

                      {/* Spaced repetition status footer */}
                      <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 mt-1 select-none">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Next: {card.nextReviewDate ? (
                            <span className={isCardDue ? 'text-accent-amber font-bold' : 'text-slate-400'}>
                              {card.nextReviewDate} {isCardDue && '(Due)'}
                            </span>
                          ) : (
                            <span className="text-accent-blue font-bold">Unreviewed</span>
                          )}
                        </span>
                        <span>
                          Grade: {card.latestGrade !== undefined ? `${card.latestGrade}/5` : 'None'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Fullscreen Immersive Study Session Modal */}
      {isStudying && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-[#05060b]/80 backdrop-blur-2xl transition-all duration-500">
          
          {/* Dynamic Ambient Background backplate glow matching card category */}
          {(() => {
            const currentCardCat = currentCard?.categoryId !== undefined ? categoriesMap.get(currentCard.categoryId) : undefined
            const glowColor = currentCardCat?.color ?? '#c5a880'
            return (
              <div
                className="absolute h-96 w-96 rounded-full blur-[140px] opacity-15 pointer-events-none transition-all duration-1000 ease-in-out"
                style={{
                  backgroundColor: glowColor,
                  transform: 'translate(-50%, -50%)',
                  left: '50%',
                  top: '55%'
                }}
              />
            )
          })()}

          <div className="relative w-full max-w-lg flex flex-col items-center gap-6 z-10">
            
            {/* Modal Exit Trigger */}
            <button
              onClick={() => setIsStudying(false)}
              className="absolute top-0 right-0 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full cursor-pointer transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Title / Progress */}
            {!sessionCompleted && (
              <div className="text-center w-full max-w-md select-none">
                <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase">
                  Active Recall Practice
                </span>
                <h3 className="text-sm font-bold text-white mt-1">
                  Card {currentQueueIndex + 1} of {studyQueue.length}
                </h3>
                {/* Progress bar */}
                <div className="h-1.5 w-full bg-white/5 border border-white/5 p-[1px] rounded-full overflow-hidden mt-3">
                  <div
                    className="h-full bg-gradient-to-r from-accent-blue to-accent-purple transition-all duration-300 shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                    style={{ width: `${((currentQueueIndex) / studyQueue.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Immersive Study Container */}
            {sessionCompleted ? (
              <div className="w-full max-w-md p-6 rounded-2xl border border-white/15 bg-white/5 backdrop-blur-2xl shadow-2xl flex flex-col items-center justify-center text-center animate-slide-in-up">
                <div className="h-12 w-12 rounded-2xl bg-accent-green/20 border border-accent-green/30 flex items-center justify-center mb-4 text-accent-green animate-pulse-soft">
                  <Sparkles className="h-6 w-6 text-accent-green" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-wide text-gradient-green">Review Complete!</h3>
                <p className="text-xs text-slate-400 mb-6 max-w-xs select-none">
                  Excellent work. You completed reviews for {cardsGradedCount} flashcards. Spaced repetition dates have been rescheduled.
                </p>
                <button
                  onClick={() => setIsStudying(false)}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-white/10 border border-white/10 hover:bg-white/15 transition-all text-white cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center gap-6">
                
                {/* Flippable Card Container */}
                <div className="w-full aspect-[4/3] max-w-md perspective-1000">
                  <div
                    onClick={() => setIsFlipped(f => !f)}
                    className={`relative w-full h-full flashcard-inner cursor-pointer select-none rounded-2xl ${
                      isFlipped ? 'rotate-y-180' : ''
                    }`}
                  >
                    {/* FRONT */}
                    <div className="absolute inset-0 backface-hidden glass-tier-2 border border-white/10 flex flex-col items-center justify-center p-6 text-center select-none shadow-[0_24px_48px_rgba(0,0,0,0.5)]">
                      <span className="text-[9px] font-mono tracking-widest text-slate-400 uppercase absolute top-5 select-none">
                        Question Prompt
                      </span>
                      <p className="text-base md:text-lg font-bold text-white px-4 max-h-40 overflow-y-auto whitespace-pre-wrap select-none leading-relaxed">
                        {currentCard.question}
                      </p>
                      <span className="text-[9px] font-mono text-slate-500 absolute bottom-5 animate-pulse uppercase select-none tracking-widest font-bold">
                        Click card to flip
                      </span>
                    </div>

                    {/* BACK */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180 glass-tier-2 border border-white/15 flex flex-col items-center justify-center p-6 text-center select-none bg-white/[0.04] shadow-[0_24px_48px_rgba(0,0,0,0.5)]">
                      <span className="text-[9px] font-mono tracking-widest text-accent-amber uppercase absolute top-5 select-none font-bold">
                        Definition Answer
                      </span>
                      <p className="text-base md:text-lg font-extrabold text-accent-amber px-4 max-h-40 overflow-y-auto whitespace-pre-wrap select-none leading-relaxed">
                        {currentCard.answer}
                      </p>
                      <span className="text-[9px] font-mono text-slate-500 absolute bottom-5 uppercase select-none tracking-widest">
                        Click card to flip back
                      </span>
                    </div>

                  </div>
                </div>

                {/* SM-2 Recall Grading Deck */}
                <div className={`w-full max-w-md transition-all duration-300 ${isFlipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                  <p className="text-[10px] font-mono text-center text-white/50 mb-3 select-none uppercase tracking-wider font-bold">
                    Rate retrieval strength (SM-2):
                  </p>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {grades.map(grade => (
                      <button
                        key={grade.value}
                        onClick={() => handleGrade(grade.value)}
                        className={`p-3 rounded-2xl border bg-black/40 flex flex-col items-center justify-center gap-0.5 transition-all duration-300 group cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.2)] hover:-translate-y-1 ${grade.color}`}
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
      )}
    </div>
  )
}
