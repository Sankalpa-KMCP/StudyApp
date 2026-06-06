import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { FlashcardItem } from '../types'
import * as flashcardRepo from '../repositories/flashcards'

export function useFlashcards() {
  const flashcards = useLiveQuery<FlashcardItem[]>(() => db.flashcards.toArray())

  return {
    flashcards: flashcards ?? [],
    addFlashcard: flashcardRepo.addFlashcard,
    deleteFlashcard: flashcardRepo.deleteFlashcard,
    submitFlashcardGrade: flashcardRepo.submitFlashcardGrade,
    isLoading: flashcards === undefined,
  }
}
