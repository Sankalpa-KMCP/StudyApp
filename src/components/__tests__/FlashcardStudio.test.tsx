import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlashcardStudio } from '../FlashcardStudio'

const requestConfirm = vi.fn().mockResolvedValue(false)

vi.mock('../../context/useConfirm', () => ({
  useConfirm: () => ({ requestConfirm }),
}))

const baseProps = {
  categories: [],
  addCategory: vi.fn(),
  deleteCategory: vi.fn(),
  flashcards: [{
    id: 1,
    question: 'What is SM-2?',
    answer: 'Spaced repetition',
    createdAt: Date.now(),
    repetitionCount: 0,
    easinessFactor: 2.5,
    intervalDays: 0,
  }],
  addFlashcard: vi.fn().mockResolvedValue(undefined),
  deleteFlashcard: vi.fn(),
  submitFlashcardGrade: vi.fn(),
}

describe('FlashcardStudio', () => {
  it('does not render duplicate page title heading', () => {
    render(<FlashcardStudio {...baseProps} />)
    expect(screen.queryByRole('heading', { name: 'Active Recall Deck' })).not.toBeInTheDocument()
  })

  it('wraps content in TabPageShell stack layout', () => {
    const { container } = render(<FlashcardStudio {...baseProps} />)
    expect(container.querySelector('.tab-page-shell')).toBeInTheDocument()
  })

  it('creates a flashcard when the form is submitted', async () => {
    const user = userEvent.setup()
    const addFlashcard = vi.fn().mockResolvedValue(undefined)
    render(<FlashcardStudio {...baseProps} flashcards={[]} addFlashcard={addFlashcard} />)
    await user.type(screen.getByPlaceholderText('Enter front side question...'), 'What is SM-2?')
    await user.type(screen.getByPlaceholderText('Enter back side answer detail...'), 'Spaced repetition')
    await user.click(screen.getByRole('button', { name: /add to deck/i }))
    expect(addFlashcard).toHaveBeenCalledWith('What is SM-2?', 'Spaced repetition', undefined)
  })

  it('requires confirm before deleting a flashcard', async () => {
    const user = userEvent.setup()
    const deleteFlashcard = vi.fn()
    requestConfirm.mockResolvedValueOnce(true)
    render(<FlashcardStudio {...baseProps} deleteFlashcard={deleteFlashcard} />)
    await user.click(screen.getByRole('button', { name: /delete flashcard what is sm-2/i }))
    expect(requestConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete flashcard?' }))
    expect(deleteFlashcard).toHaveBeenCalledWith(1)
  })
})
