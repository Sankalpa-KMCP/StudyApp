import { useState } from 'react'
import type { FlashcardItem } from '../../db/types'

export function useFlashcardStudySession(
  filteredCards: FlashcardItem[],
  isDue: (card: FlashcardItem) => boolean,
  submitFlashcardGrade: (id: number, grade: number) => Promise<void>,
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

  const closeStudy = () => {
    setIsStudying(false)
    setStudyQueue([])
    setSessionCompleted(false)
  }

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
