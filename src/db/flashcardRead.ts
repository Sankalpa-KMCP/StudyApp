import { studyDb } from './studyDb'
import type { Flashcard } from './types'

/** Ordered Flashcard rows for the App-owned Flashcards live query (same order as former shell/`getStudyData`). */
export async function listFlashcards(): Promise<Flashcard[]> {
  return studyDb.flashcards.orderBy('createdAt').toArray()
}
