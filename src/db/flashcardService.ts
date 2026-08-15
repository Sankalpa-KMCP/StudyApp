import { nextFlashcardSchedule } from '../appUtils'
import { createId, nowIso, studyDb } from './studyDb'
import type { Flashcard } from './types'

/** Fields the Flashcards editor supplies after front/back validation. */
export type FlashcardWriteFields = {
  front: string
  back: string
  subjectId: string
}

/**
 * Persist a new flashcard with review defaults. Owns id and created/updated timestamps.
 */
export async function createFlashcard(fields: FlashcardWriteFields): Promise<Flashcard> {
  const timestamp = nowIso()
  const card: Flashcard = {
    id: createId('card'),
    front: fields.front,
    back: fields.back,
    subjectId: fields.subjectId,
    status: 'new',
    lastReviewedAt: '',
    dueAt: timestamp,
    intervalDays: 0,
    reviewCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await studyDb.flashcards.add(card)
  return card
}

/**
 * Update an existing flashcard's editable fields and refresh `updatedAt`.
 * Throws when no row matches `id`.
 */
export async function updateFlashcard(id: string, fields: FlashcardWriteFields): Promise<void> {
  const updated = await studyDb.flashcards.update(id, {
    front: fields.front,
    back: fields.back,
    subjectId: fields.subjectId,
    updatedAt: nowIso(),
  })
  if (updated === 0) throw new Error('Flashcard no longer exists.')
}

/**
 * Record a review result using the shared scheduling helper and refresh timestamps.
 * Throws when no row matches `card.id`.
 */
export async function reviewFlashcard(
  card: Flashcard,
  result: 'learning' | 'remembered',
): Promise<void> {
  const reviewedAt = nowIso()
  const schedule = nextFlashcardSchedule(card, result, new Date(reviewedAt))
  const updated = await studyDb.flashcards.update(card.id, {
    status: result,
    lastReviewedAt: reviewedAt,
    updatedAt: reviewedAt,
    ...schedule,
  })
  if (updated === 0) throw new Error('Flashcard no longer exists.')
}

/**
 * Delete a flashcard by id. Missing rows are not treated as errors (Dexie delete is idempotent).
 */
export async function deleteFlashcard(id: string): Promise<void> {
  await studyDb.flashcards.delete(id)
}
