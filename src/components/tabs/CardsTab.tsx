import { FlashcardStudio } from '../FlashcardStudio'
import { useStudyApp } from '../../context/useStudyApp'

export function CardsTab() {
  const { categories, flashcards } = useStudyApp()

  return (
    <FlashcardStudio
      categories={categories.categories}
      addCategory={categories.addCategory}
      deleteCategory={categories.deleteCategory}
      flashcards={flashcards.flashcards}
      addFlashcard={flashcards.addFlashcard}
      deleteFlashcard={flashcards.deleteFlashcard}
      submitFlashcardGrade={flashcards.submitFlashcardGrade}
    />
  )
}
