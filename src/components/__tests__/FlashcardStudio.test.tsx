import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlashcardStudio } from '../FlashcardStudio'

const baseProps = {
  categories: [],
  addCategory: vi.fn(),
  deleteCategory: vi.fn(),
  flashcards: [],
  addFlashcard: vi.fn().mockResolvedValue(undefined),
  deleteFlashcard: vi.fn(),
  submitFlashcardGrade: vi.fn(),
}

describe('FlashcardStudio', () => {
  it('renders active recall deck heading', () => {
    render(<FlashcardStudio {...baseProps} />)
    expect(screen.getByText('Active Recall Deck')).toBeInTheDocument()
  })

  it('creates a flashcard when the form is submitted', async () => {
    const user = userEvent.setup()
    const addFlashcard = vi.fn().mockResolvedValue(undefined)
    render(<FlashcardStudio {...baseProps} addFlashcard={addFlashcard} />)
    await user.type(screen.getByPlaceholderText('Enter front side question...'), 'What is SM-2?')
    await user.type(screen.getByPlaceholderText('Enter back side answer detail...'), 'Spaced repetition')
    await user.click(screen.getByRole('button', { name: /add to deck/i }))
    expect(addFlashcard).toHaveBeenCalledWith('What is SM-2?', 'Spaced repetition', undefined)
  })
})
