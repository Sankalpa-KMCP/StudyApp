import React, { useState, useMemo } from 'react'
import { Layers, Plus, Trash2, X, GraduationCap, Calendar, Sparkles } from 'lucide-react'
import type { CategoryItem, FlashcardItem } from '../db/types'

interface FlashcardStudioProps {
  categories: CategoryItem[]
  addCategory: (name: string, color: string) => Promise<void> | void
  deleteCategory: (id: number) => Promise<void> | void
  flashcards: FlashcardItem[]
  addFlashcard: (question: string, answer: string, categoryId?: number) => Promise<void>
  deleteFlashcard: (id: number) => Promise<void>
  submitFlashcardGrade: (id: number, grade: number) => Promise<void>
}

export const FlashcardStudio: React.FC<FlashcardStudioProps> = ({
  categories,
  addCategory,
  deleteCategory,
  flashcards,
  addFlashcard,
  deleteFlashcard,
  submitFlashcardGrade
}) => {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | number>('all')
  const [activeSpacingFilter, setActiveSpacingFilter] = useState<'all' | 'due' | 'new' | 'completed'>('all')
  const [newQuestion, setNewQuestion] = useState('')
  const [newAnswer, setNewAnswer] = useState('')
  const [newCategoryId, setNewCategoryId] = useState<number | undefined>(undefined)

  // Category Manager states
  const [showCatManager, setShowCatManager] = useState(false)
  const [inlineCatName, setInlineCatName] = useState('')
  const [inlineCatColor, setInlineCatColor] = useState('#3B82F6')
  
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
    return flashcards.filter(c => {
      const matchesCategory = activeCategoryFilter === 'all' || c.categoryId === activeCategoryFilter
      if (!matchesCategory) return false

      if (activeSpacingFilter === 'all') return true
      if (activeSpacingFilter === 'new') return c.latestGrade === undefined
      if (activeSpacingFilter === 'due') return c.latestGrade !== undefined && (!c.nextReviewDate || c.nextReviewDate <= todayStr)
      if (activeSpacingFilter === 'completed') return c.latestGrade !== undefined && c.nextReviewDate && c.nextReviewDate > todayStr

      return true
    })
  }, [flashcards, activeCategoryFilter, activeSpacingFilter, todayStr])

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
    { value: 0, label: 'Forgot', desc: 'Blackout', color: 'text-red-400' },
    { value: 1, label: 'Incorrect', desc: 'Wrong', color: 'text-orange-400' },
    { value: 2, label: 'Hard', desc: 'Barely', color: 'text-amber-300' },
    { value: 3, label: 'Good', desc: 'Effort', color: 'text-green-400' },
    { value: 4, label: 'Easy', desc: 'Correct', color: 'text-blue-400' },
    { value: 5, label: 'Perfect', desc: 'Instant', color: 'text-purple-400' },
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
          <p className="text-xs text-white/50 mt-1 select-none">
            Utilize the SuperMemo-2 scheduler to systematically optimize cognitive retention.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveCategoryFilter('all')}
            className={`px-4.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ios-active-scale ${
              activeCategoryFilter === 'all'
                ? 'bg-white/10 text-white border-white/10'
                : 'bg-white/[0.02] text-white/60 border-white/5 hover:text-white'
            }`}
          >
            All Decks
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => cat.id !== undefined && setActiveCategoryFilter(cat.id)}
              className={`px-4.5 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ios-active-scale ${
                activeCategoryFilter === cat.id
                  ? 'text-white border-white/10'
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
          <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase">Total Flashcards</span>
          <span className="text-2xl font-bold text-white mt-2 font-mono">{stats.total}</span>
        </div>
        <div className="dynamic-card p-4 flex flex-col justify-between">
          <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase">Due For Review</span>
          <span className={`text-2xl font-bold mt-2 font-mono ${stats.due > 0 ? 'text-accent-amber' : 'text-accent-green'}`}>
            {stats.due}
          </span>
        </div>
        <div className="dynamic-card p-4 flex flex-col justify-between">
          <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase">Average Recall Grade</span>
          <span className="text-2xl font-bold text-white mt-2 font-mono">{stats.avgGrade} <span className="text-xs text-white/30">/ 5.0</span></span>
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
                <label className="block text-[10px] font-bold uppercase text-white/45 mb-1.5 select-none">Question / Term</label>
                <textarea
                  required
                  rows={2}
                  value={newQuestion}
                  onChange={e => setNewQuestion(e.target.value)}
                  placeholder="Enter front side question..."
                  className="w-full rounded-2xl border border-white/8 bg-white/4 px-4 py-2.5 text-xs text-white placeholder-white/25 outline-none transition-all focus:bg-white/8 focus:border-accent-blue/30"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-white/45 mb-1.5 select-none">Answer / Definition</label>
                <textarea
                  required
                  rows={3}
                  value={newAnswer}
                  onChange={e => setNewAnswer(e.target.value)}
                  placeholder="Enter back side answer detail..."
                  className="w-full rounded-2xl border border-white/8 bg-white/4 px-4 py-2.5 text-xs text-white placeholder-white/25 outline-none transition-all focus:bg-white/8 focus:border-accent-blue/30"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5 select-none">
                  <label className="text-[10px] font-bold uppercase text-white/45">Deck Category</label>
                  <button
                    type="button"
                    onClick={() => setShowCatManager(!showCatManager)}
                    className="text-[9px] font-bold text-accent-blue hover:underline cursor-pointer"
                  >
                    {showCatManager ? 'Done' : '✏️ Manage'}
                  </button>
                </div>
                
                {showCatManager ? (
                  <div className="space-y-2.5 bg-black/20 border border-white/5 p-3 rounded-2xl animate-fade-in mb-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inlineCatName}
                        onChange={e => setInlineCatName(e.target.value)}
                        placeholder="New category label..."
                        className="flex-1 rounded-full bg-white/5 border border-white/8 px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none"
                      />
                      <input
                        type="color"
                        value={inlineCatColor}
                        onChange={e => setInlineCatColor(e.target.value)}
                        className="h-7 w-7 shrink-0 cursor-pointer rounded-full border border-white/10 bg-[#0c0f17] p-0.5"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const name = inlineCatName.trim()
                          if (name) {
                            await addCategory(name, inlineCatColor)
                            setInlineCatName('')
                          }
                        }}
                        className="px-3 rounded-full bg-accent-blue text-white text-xs font-bold transition-all ios-active-scale cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                    
                    <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1.5 pr-1 border-t border-white/5 pt-2">
                      {categories.map(c => (
                        <div key={c.id} className="flex items-center justify-between text-[10px] font-semibold bg-white/5 px-2.5 py-1.5 rounded-lg">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                            <span className="text-white/80 truncate">{c.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (c.id !== undefined) await deleteCategory(c.id)
                            }}
                            className="text-white/40 hover:text-red-400 font-bold transition-colors cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <select
                    value={newCategoryId ?? ''}
                    onChange={e => setNewCategoryId(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full rounded-full border border-white/8 bg-white/4 px-4 py-2.5 text-xs text-white outline-none transition-all focus:bg-white/8 focus:border-accent-blue/30 cursor-pointer"
                  >
                    <option value="" className="bg-[#0b0c10] text-white/45">Uncategorized</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id} className="bg-[#0b0c10] text-white">
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-full text-xs font-semibold bg-white/5 border border-white/8 text-white hover:bg-white/10 transition-all ios-active-scale cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add to Deck
              </button>
            </form>
          </div>

          {/* Practice Action Panel */}
          <div className="dynamic-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Study Decks</h3>
            <p className="text-[11px] text-white/40 select-none leading-relaxed">
              Reviewing cards periodically trains active recall. Shuffle is active by default.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => startStudy(true)}
                disabled={stats.due === 0}
                className={`py-3.5 rounded-[20px] text-xs font-semibold border flex flex-col items-center justify-center gap-1 transition-all ios-active-scale ${
                  stats.due > 0
                    ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/20 hover:bg-accent-blue/20 cursor-pointer'
                    : 'bg-white/[0.02] text-white/30 border-white/5 cursor-not-allowed'
                }`}
              >
                <GraduationCap className="h-4.5 w-4.5" />
                <span>Study Due ({stats.due})</span>
              </button>
              <button
                onClick={() => startStudy(false)}
                disabled={stats.total === 0}
                className={`py-3.5 rounded-[20px] text-xs font-semibold border flex flex-col items-center justify-center gap-1 transition-all ios-active-scale ${
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 select-none">
            <h3 className="text-sm font-semibold text-white">Flashcards Registry</h3>
            
            {/* Spacing Status Filter Switches */}
            <div className="flex bg-black/35 border border-white/5 p-1 rounded-xl">
              {(['all', 'new', 'due', 'completed'] as const).map(status => {
                const count = flashcards.filter(c => {
                  const matchesCategory = activeCategoryFilter === 'all' || c.categoryId === activeCategoryFilter
                  if (!matchesCategory) return false
                  if (status === 'all') return true
                  if (status === 'new') return c.latestGrade === undefined
                  if (status === 'due') return c.latestGrade !== undefined && (!c.nextReviewDate || c.nextReviewDate <= todayStr)
                  if (status === 'completed') return c.latestGrade !== undefined && c.nextReviewDate && c.nextReviewDate > todayStr
                  return true
                }).length

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setActiveSpacingFilter(status)}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      activeSpacingFilter === status
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-white/40 hover:text-white'
                    }`}
                  >
                    {status} ({count})
                  </button>
                )
              })}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
            {filteredCards.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/10 rounded-[24px] bg-white/2">
                <Layers className="h-8 w-8 text-white/20 mb-3" />
                <p className="text-xs text-white/30 select-none">No cards created yet in this deck.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCards.map(card => {
                  const cat = card.categoryId !== undefined ? categoriesMap.get(card.categoryId) : undefined
                  const isCardDue = isDue(card)
                  return (
                    <div
                      key={card.id}
                      className="group p-4.5 rounded-[22px] border border-white/8 bg-white/4 hover:bg-white/8 transition-all flex flex-col justify-between gap-3 relative shadow-sm"
                    >
                      {/* Top Header info */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <span
                            className="inline-block text-[8px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border"
                            style={cat ? { backgroundColor: 'transparent', borderColor: cat.color, color: cat.color } : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.08)' }}
                          >
                            {cat ? cat.name : 'Uncategorized'}
                          </span>
                          <p className="text-xs font-semibold text-white leading-normal pr-4 line-clamp-2">
                            {card.question}
                          </p>
                        </div>
                        <button
                          onClick={() => card.id !== undefined && deleteFlashcard(card.id)}
                          className="text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/5 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-white/5" />

                      {/* Answer Preview */}
                      <p className="text-[10px] text-white/50 leading-normal line-clamp-2 italic">
                        {card.answer}
                      </p>

                      {/* Spaced repetition status footer */}
                      <div className="flex items-center justify-between text-[8px] font-mono text-white/40 mt-1 select-none">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Next: {card.nextReviewDate ? (
                            <span className={isCardDue ? 'text-accent-amber font-bold' : 'text-white/45'}>
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
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-3xl transition-all duration-500" style={{ background: 'radial-gradient(circle at 50% 0%, #17122b 0%, #080611 60%, #020105 100%)' }}>
          
          <div className="relative w-full max-w-lg flex flex-col items-center gap-6 z-10">
            
            {/* Modal Exit Trigger */}
            <button
              onClick={() => setIsStudying(false)}
              className="absolute -top-12 right-0 md:top-0 md:-right-12 h-10 w-10 flex items-center justify-center rounded-full bg-white/5 border border-white/8 text-white/70 hover:text-white hover:bg-white/10 cursor-pointer transition-all ios-active-scale shadow-md"
              title="Close Study Mode"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Title / Progress */}
            {!sessionCompleted && (
              <div className="text-center w-full max-w-md select-none animate-fade-in">
                <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">
                  Active Recall Practice
                </span>
                <h3 className="text-sm font-bold text-white mt-1">
                  Card {currentQueueIndex + 1} of {studyQueue.length}
                </h3>
                {/* Progress bar */}
                <div className="h-1.5 w-full bg-white/5 border border-white/8 rounded-full overflow-hidden mt-3">
                  <div
                    className="h-full bg-accent-blue transition-all duration-300"
                    style={{ width: `${((currentQueueIndex) / studyQueue.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Immersive Study Container */}
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
                  onClick={() => setIsStudying(false)}
                  className="px-6 py-3 rounded-full text-xs font-semibold bg-accent-blue text-white hover:bg-accent-blue/90 border border-white/10 transition-all cursor-pointer shadow-md ios-active-scale"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center gap-6 animate-slide-in-up">
                
                {/* Simplified Card Panel */}
                <div className="w-full aspect-[4/3] max-w-md">
                  <div
                    onClick={() => setIsFlipped(f => !f)}
                    className="w-full h-full cursor-pointer select-none rounded-[28px] border border-white/8 bg-[#161620]/45 backdrop-blur-2xl hover:bg-white/5 hover:border-white/15 transition-all flex flex-col items-center justify-center p-6 text-center shadow-[0_24px_50px_rgba(0,0,0,0.35)] relative ios-active-scale"
                  >
                    {!isFlipped ? (
                      <>
                        <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase absolute top-5 select-none font-semibold">
                          Question Prompt
                        </span>
                        <p className="text-base md:text-lg font-bold text-white px-4 max-h-40 overflow-y-auto whitespace-pre-wrap select-none leading-relaxed">
                          {currentCard.question}
                        </p>
                        <span className="text-[9px] font-mono text-white/30 absolute bottom-5 uppercase select-none tracking-widest font-bold">
                          Click to reveal answer
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[9px] font-mono tracking-widest text-accent-blue uppercase absolute top-5 select-none font-bold">
                          Definition Answer
                        </span>
                        <p className="text-base md:text-lg font-bold text-white px-4 max-h-40 overflow-y-auto whitespace-pre-wrap select-none leading-relaxed">
                          {currentCard.answer}
                        </p>
                        <span className="text-[9px] font-mono text-white/30 absolute bottom-5 uppercase select-none tracking-widest font-bold">
                          Click to show question
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* SM-2 Recall Grading Deck */}
                <div className={`w-full max-w-md transition-all duration-300 ${isFlipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                  <p className="text-[10px] font-mono text-center text-white/40 mb-3 select-none uppercase tracking-wider font-bold">
                    Rate retrieval strength (SM-2):
                  </p>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {grades.map(grade => (
                      <button
                        key={grade.value}
                        onClick={() => handleGrade(grade.value)}
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
      )}
    </div>
  )
}
