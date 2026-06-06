import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FlashcardStudio } from '../FlashcardStudio'

describe('FlashcardStudio', () => {
  it('renders active recall deck heading', () => {
    render(
      <FlashcardStudio
        categories={[]}
        addCategory={vi.fn()}
        deleteCategory={vi.fn()}
        flashcards={[]}
        addFlashcard={vi.fn()}
        deleteFlashcard={vi.fn()}
        submitFlashcardGrade={vi.fn()}
      />,
    )
    expect(screen.getByText('Active Recall Deck')).toBeInTheDocument()
  })
})
