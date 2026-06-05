import { lazy, Suspense } from 'react'
import { useStudyApp } from '../../context/useStudyApp'

const FlashcardStudio = lazy(() =>
  import('../FlashcardStudio').then(m => ({ default: m.FlashcardStudio })),
)

export function CardsTab() {
  const { categories, flashcards } = useStudyApp()

  return (
    <Suspense fallback={<div className="p-6 text-white/50 text-sm animate-pulse">Loading recall deck…</div>}>
      <FlashcardStudio
        categories={categories.categories}
        addCategory={categories.addCategory}
        deleteCategory={categories.deleteCategory}
        flashcards={flashcards.flashcards}
        addFlashcard={flashcards.addFlashcard}
        deleteFlashcard={flashcards.deleteFlashcard}
        submitFlashcardGrade={flashcards.submitFlashcardGrade}
      />
    </Suspense>
  )
}
