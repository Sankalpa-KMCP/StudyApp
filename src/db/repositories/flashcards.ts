import { db } from '../db'
import type { FlashcardItem } from '../types'
import { buildDateString, calculateSM2 } from '../../lib/study/studyDashboard'
import { getInitialEasinessFactor } from './settings'

export async function addFlashcard(question: string, answer: string, categoryId?: number) {
  const initialEF = await getInitialEasinessFactor()
  await db.flashcards.add({
    question,
    answer,
    categoryId,
    createdAt: Date.now(),
    repetitionCount: 0,
    easinessFactor: initialEF,
    intervalDays: 0,
  })
}

export async function deleteFlashcard(id: number) {
  await db.flashcards.delete(id)
}

export async function restoreFlashcard(card: FlashcardItem): Promise<void> {
  await db.flashcards.put(card)
}

export async function getAllFlashcards(): Promise<FlashcardItem[]> {
  return db.flashcards.toArray()
}

export function computeNextReviewDate(intervalDays: number): string {
  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + intervalDays)
  return buildDateString(nextDate)
}

export async function submitFlashcardGrade(id: number, q: number) {
  const card: FlashcardItem | undefined = await db.flashcards.get(id)
  if (!card) return
  const initialEF = await getInitialEasinessFactor()
  const { repetitionCount, easinessFactor, intervalDays } = calculateSM2(
    q,
    card.repetitionCount ?? 0,
    card.easinessFactor ?? initialEF,
    card.intervalDays ?? 0,
  )

  await db.flashcards.update(id, {
    repetitionCount,
    easinessFactor,
    intervalDays,
    nextReviewDate: computeNextReviewDate(intervalDays),
    latestGrade: q,
  })
}
