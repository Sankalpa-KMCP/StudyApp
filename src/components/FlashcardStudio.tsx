import React, { useState } from 'react'
import { Layers } from 'lucide-react'
import type { CategoryItem, FlashcardItem } from '../db/types'
import { useConfirm } from '../context/useConfirm'
import { useCategoriesMap } from '../hooks/useCategoriesMap'
import { useFlashcardFilters } from './flashcard/useFlashcardFilters'
import { useFlashcardStudySession } from './flashcard/useFlashcardStudySession'
import { FlashcardCreateForm } from './flashcard/FlashcardCreateForm'
import { FlashcardRegistry } from './flashcard/FlashcardRegistry'
import { FlashcardStudyModal } from './flashcard/FlashcardStudyModal'
import { TabPageShell, TabSection } from './shared/TabPageShell'
import { MetricCard } from './shared/MetricCard'

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
  const { requestConfirm } = useConfirm()

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
  } = useFlashcardStudySession(filteredCards, isDue, submitFlashcardGrade, requestConfirm)

  const handleDeleteFlashcard = async (id: number) => {
    const card = flashcards.find(c => c.id === id)
    const ok = await requestConfirm({
      title: 'Delete flashcard?',
      message: card ? `"${card.question.slice(0, 80)}${card.question.length > 80 ? '…' : ''}" will be removed permanently.` : 'This card will be removed permanently.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) await deleteFlashcard(id)
  }

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQuestion.trim() || !newAnswer.trim()) return
    await addFlashcard(newQuestion.trim(), newAnswer.trim(), newCategoryId)
    setNewQuestion('')
    setNewAnswer('')
  }

  return (
    <TabPageShell>
      <TabSection label="Filter by subject">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveCategoryFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ios-active-scale ${
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
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ios-active-scale ${
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
      </TabSection>

      <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Total Flashcards" value={String(stats.total)} icon={Layers} />
        <MetricCard
          label="Due For Review"
          value={String(stats.due)}
          valueClassName={stats.due > 0 ? 'text-accent-amber' : 'text-accent-green'}
        />
        <MetricCard label="Average Recall Grade" value={`${stats.avgGrade} / 5.0`} />
      </div>

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
        onDelete={id => { void handleDeleteFlashcard(id) }}
        onFocusCreate={() => document.getElementById('flashcard-question')?.focus()}
      />

      {isStudying && currentCard && (
        <FlashcardStudyModal
          isFlipped={isFlipped}
          setIsFlipped={setIsFlipped}
          sessionCompleted={sessionCompleted}
          cardsGradedCount={cardsGradedCount}
          studyQueue={studyQueue}
          currentQueueIndex={currentQueueIndex}
          currentCard={currentCard}
          onClose={() => { void closeStudy() }}
          onGrade={handleGrade}
        />
      )}
    </TabPageShell>
  )
}
