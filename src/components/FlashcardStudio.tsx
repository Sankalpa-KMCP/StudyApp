import React, { useState } from 'react'
import { Layers } from 'lucide-react'
import type { CategoryItem, FlashcardItem } from '../db/types'
import { useCategoriesMap } from '../hooks/useCategoriesMap'
import { useFlashcardFilters } from './flashcard/useFlashcardFilters'
import { useFlashcardStudySession } from './flashcard/useFlashcardStudySession'
import { FlashcardCreateForm } from './flashcard/FlashcardCreateForm'
import { FlashcardRegistry } from './flashcard/FlashcardRegistry'
import { FlashcardStudyModal } from './flashcard/FlashcardStudyModal'

interface FlashcardStudioProps {
  categories: CategoryItem[]
  addCategory: (name: string, color: string) => Promise<number | void> | number | void
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
  submitFlashcardGrade,
}) => {
  const [newQuestion, setNewQuestion] = useState('')
  const [newAnswer, setNewAnswer] = useState('')
  const [newCategoryId, setNewCategoryId] = useState<number | undefined>(undefined)

  const {
    activeCategoryFilter,
    setActiveCategoryFilter,
    activeSpacingFilter,
    setActiveSpacingFilter,
    filteredCards,
    stats,
    isDue,
    todayStr,
  } = useFlashcardFilters(flashcards)

  const categoriesMap = useCategoriesMap(categories)

  const {
    isStudying,
    currentCard,
    isFlipped,
    setIsFlipped,
    sessionCompleted,
    cardsGradedCount,
    studyQueue,
    currentQueueIndex,
    startStudy,
    handleGrade,
    closeStudy,
  } = useFlashcardStudySession(filteredCards, isDue, submitFlashcardGrade)

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQuestion.trim() || !newAnswer.trim()) return
    await addFlashcard(newQuestion.trim(), newAnswer.trim(), newCategoryId)
    setNewQuestion('')
    setNewAnswer('')
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 animate-slide-in-up">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="dynamic-card p-4 flex flex-col justify-between">
          <span className="text-label font-mono tracking-widest text-white/40 uppercase">Total Flashcards</span>
          <span className="text-2xl font-bold text-white mt-2 font-mono">{stats.total}</span>
        </div>
        <div className="dynamic-card p-4 flex flex-col justify-between">
          <span className="text-label font-mono tracking-widest text-white/40 uppercase">Due For Review</span>
          <span className={`text-2xl font-bold mt-2 font-mono ${stats.due > 0 ? 'text-accent-amber' : 'text-accent-green'}`}>
            {stats.due}
          </span>
        </div>
        <div className="dynamic-card p-4 flex flex-col justify-between">
          <span className="text-label font-mono tracking-widest text-white/40 uppercase">Average Recall Grade</span>
          <span className="text-2xl font-bold text-white mt-2 font-mono">
            {stats.avgGrade} <span className="text-xs text-white/30">/ 5.0</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 min-h-0">
        <FlashcardCreateForm
          categories={categories}
          addCategory={addCategory}
          deleteCategory={deleteCategory}
          newQuestion={newQuestion}
          setNewQuestion={setNewQuestion}
          newAnswer={newAnswer}
          setNewAnswer={setNewAnswer}
          newCategoryId={newCategoryId}
          setNewCategoryId={setNewCategoryId}
          onSubmit={handleAddCard}
          stats={stats}
          onStudyDue={() => startStudy(true)}
          onStudyAll={() => startStudy(false)}
        />
        <FlashcardRegistry
          flashcards={flashcards}
          filteredCards={filteredCards}
          categoriesMap={categoriesMap}
          activeCategoryFilter={activeCategoryFilter}
          activeSpacingFilter={activeSpacingFilter}
          setActiveSpacingFilter={setActiveSpacingFilter}
          todayStr={todayStr}
          isDue={isDue}
          onDelete={deleteFlashcard}
        />
      </div>

      {isStudying && currentCard && (
        <FlashcardStudyModal
          isFlipped={isFlipped}
          setIsFlipped={setIsFlipped}
          sessionCompleted={sessionCompleted}
          cardsGradedCount={cardsGradedCount}
          studyQueue={studyQueue}
          currentQueueIndex={currentQueueIndex}
          currentCard={currentCard}
          onClose={closeStudy}
          onGrade={handleGrade}
        />
      )}
    </div>
  )
}
