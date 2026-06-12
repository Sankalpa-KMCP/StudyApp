import { lazy, Suspense } from 'react'
import { TabLoadingFallback } from '../shared/TabLoadingFallback'
import { db } from '../../db/db'
import { useStudyData, useStudyUI } from '../../context/useStudyApp'

const FlashcardStudio = lazy(() =>
  import('../FlashcardStudio').then(m => ({ default: m.FlashcardStudio })),
)

export function CardsTab() {
  const { categories, flashcards } = useStudyData()
  const { scheduleDelete } = useStudyUI()

  const handleDeleteFlashcard = async (id: number) => {
    const card = flashcards.flashcards.find(c => c.id === id)
    if (!card) return
    scheduleDelete(
      'Card',
      () => flashcards.deleteFlashcard(id),
      async () => { await db.flashcards.put(card) },
    )
  }

  return (
    <Suspense fallback={<TabLoadingFallback label="flashcards" />}>
      <FlashcardStudio
        categories={categories.categories}
        addCategory={categories.addCategory}
        deleteCategory={categories.deleteCategory}
        flashcards={flashcards.flashcards}
        addFlashcard={flashcards.addFlashcard}
        deleteFlashcard={handleDeleteFlashcard}
        submitFlashcardGrade={flashcards.submitFlashcardGrade}
      />
    </Suspense>
  )
}
