import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { FlashcardItem } from '../types'
import * as flashcardRepo from '../repositories/flashcards'

export function useFlashcards(enabled = true) {
  const flashcards = useLiveQuery<FlashcardItem[]>(() => {
    if (!enabled) return Promise.resolve([])
    return db.flashcards.toArray()
  }, [enabled])

  return {
    flashcards: flashcards ?? [],
    addFlashcard: enabled ? flashcardRepo.addFlashcard : async () => {},
    deleteFlashcard: enabled ? flashcardRepo.deleteFlashcard : async () => {},
    submitFlashcardGrade: enabled ? flashcardRepo.submitFlashcardGrade : async () => {},
    isLoading: enabled ? flashcards === undefined : false,
  }
}
