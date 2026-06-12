export const FLASHCARD_REVIEW_PENDING_KEY = 'flashcards_open_review_pending'

export function setFlashcardReviewPending() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(FLASHCARD_REVIEW_PENDING_KEY, 'true')
}

export function consumeFlashcardReviewPending(): boolean {
  if (typeof sessionStorage === 'undefined') return false
  const pending = sessionStorage.getItem(FLASHCARD_REVIEW_PENDING_KEY) === 'true'
  if (pending) sessionStorage.removeItem(FLASHCARD_REVIEW_PENDING_KEY)
  return pending
}
