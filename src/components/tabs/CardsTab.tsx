import { lazy, Suspense } from 'react'
import { TabLoadingFallback } from '../shared/TabLoadingFallback'
import { useStudyData } from '../../context/useStudyApp'

const FlashcardStudio = lazy(() =>
  import('../FlashcardStudio').then(m => ({ default: m.FlashcardStudio })),
)

export function CardsTab() {
  const { categories, flashcards } = useStudyData()

  return (
    <Suspense fallback={<TabLoadingFallback label="recall deck" />}>
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
