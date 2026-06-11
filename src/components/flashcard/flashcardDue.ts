import type { FlashcardItem } from '../../db/types'

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function isFlashcardDue(card: FlashcardItem, todayStr: string = todayISO()): boolean {
  return !card.nextReviewDate || card.nextReviewDate <= todayStr
}

export function countDueFlashcards(cards: FlashcardItem[], todayStr: string = todayISO()): number {
  return cards.filter(c => isFlashcardDue(c, todayStr)).length
}
