import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlashcardsDueBanner } from '../FlashcardsDueBanner'
import type { FlashcardItem } from '../../../db/types'

const dueCard: FlashcardItem = {
  id: 1,
  question: 'Q',
  answer: 'A',
  createdAt: Date.now(),
  repetitionCount: 0,
  easinessFactor: 2.5,
  intervalDays: 1,
  nextReviewDate: '2000-01-01',
}

const futureCard: FlashcardItem = {
  ...dueCard,
  id: 2,
  nextReviewDate: '2099-01-01',
}

describe('FlashcardsDueBanner', () => {
  it('renders nothing when no cards are due', () => {
    const { container } = render(
      <FlashcardsDueBanner flashcards={[futureCard]} onReview={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows due count and calls onReview', async () => {
    const user = userEvent.setup()
    const onReview = vi.fn()
    render(<FlashcardsDueBanner flashcards={[dueCard]} onReview={onReview} />)
    expect(screen.getByText(/1 card due/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Review' }))
    expect(onReview).toHaveBeenCalledTimes(1)
  })
})
