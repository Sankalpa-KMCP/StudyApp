import { useState, useCallback } from 'react'
import type { FlashcardItem } from '../../db/types'
import { END_FLASHCARD_SESSION, END_FLASHCARD_SESSION_BODY } from '../../lib/shared/uxTerms'

type RequestConfirm = (options: {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
}) => Promise<boolean>

export function useFlashcardStudySession(
  filteredCards: FlashcardItem[],
  isDue: (card: FlashcardItem) => boolean,
  submitFlashcardGrade: (id: number, grade: number) => Promise<void>,
  requestConfirm?: RequestConfirm,
) {
  const [isStudying, setIsStudying] = useState(false)
  const [studyQueue, setStudyQueue] = useState<FlashcardItem[]>([])
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [sessionCompleted, setSessionCompleted] = useState(false)
  const [cardsGradedCount, setCardsGradedCount] = useState(0)

  const startStudy = (dueOnly: boolean) => {
    const queue = dueOnly ? filteredCards.filter(isDue) : [...filteredCards]
    if (queue.length === 0) return
    const shuffled = queue.sort(() => Math.random() - 0.5)
    setStudyQueue(shuffled)
    setCurrentQueueIndex(0)
    setIsFlipped(false)
    setSessionCompleted(false)
    setCardsGradedCount(0)
    setIsStudying(true)
  }

  const handleGrade = async (grade: number) => {
    const card = studyQueue[currentQueueIndex]
    if (card.id === undefined) return
    await submitFlashcardGrade(card.id, grade)
    setCardsGradedCount(prev => prev + 1)
    if (currentQueueIndex + 1 < studyQueue.length) {
      setIsFlipped(false)
      setTimeout(() => setCurrentQueueIndex(prev => prev + 1), 200)
    } else {
      setSessionCompleted(true)
    }
  }

  const resetStudy = useCallback(() => {
    setIsStudying(false)
    setStudyQueue([])
    setSessionCompleted(false)
    setCardsGradedCount(0)
    setCurrentQueueIndex(0)
    setIsFlipped(false)
  }, [])

  const closeStudy = useCallback(async () => {
    if (cardsGradedCount > 0 && !sessionCompleted && requestConfirm) {
      const ok = await requestConfirm({
        title: END_FLASHCARD_SESSION,
        message: END_FLASHCARD_SESSION_BODY,
        confirmLabel: 'End session',
        cancelLabel: 'Keep studying',
      })
      if (!ok) return
    }
    resetStudy()
  }, [cardsGradedCount, sessionCompleted, requestConfirm, resetStudy])

  return {
    isStudying,
    studyQueue,
    currentQueueIndex,
    currentCard: studyQueue[currentQueueIndex],
    isFlipped,
    setIsFlipped,
    sessionCompleted,
    cardsGradedCount,
    startStudy,
    handleGrade,
    closeStudy,
  }
}
