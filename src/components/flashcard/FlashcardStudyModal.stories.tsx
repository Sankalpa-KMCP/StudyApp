import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { FlashcardStudyModal } from './FlashcardStudyModal'

const sampleCard = {
  id: 1,
  question: 'What is the SM-2 algorithm used for?',
  answer: 'Spaced repetition scheduling for flashcards.',
  createdAt: Date.now(),
  repetitionCount: 0,
  easinessFactor: 2.5,
  intervalDays: 1,
}

const meta: Meta<typeof FlashcardStudyModal> = {
  title: 'Cards/FlashcardStudyModal',
  component: FlashcardStudyModal,
}

export default meta
type Story = StoryObj<typeof FlashcardStudyModal>

function StudySessionDemo() {
  const [isFlipped, setIsFlipped] = useState(false)
  return (
    <FlashcardStudyModal
      isFlipped={isFlipped}
      setIsFlipped={setIsFlipped}
      sessionCompleted={false}
      cardsGradedCount={0}
      studyQueue={[sampleCard]}
      currentQueueIndex={0}
      currentCard={sampleCard}
      onClose={() => {}}
      onGrade={() => {}}
    />
  )
}

export const StudySession: Story = {
  render: () => <StudySessionDemo />,
}
