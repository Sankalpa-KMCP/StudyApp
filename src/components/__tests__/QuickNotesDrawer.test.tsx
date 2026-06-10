import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickNotesDrawer } from '../QuickNotesDrawer'
import type { CategoryItem, QuickNoteItem } from '../../db/types'

const categories: CategoryItem[] = [{ id: 1, name: 'General', color: '#64748B' }]
const notes: QuickNoteItem[] = [
  { id: 1, title: 'Alpha note', content: 'Body', updatedAt: Date.now(), categoryId: 1 },
]

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  categories,
  addCategory: vi.fn(),
  deleteCategory: vi.fn(),
  notes,
  addNote: vi.fn().mockResolvedValue(undefined),
  updateNote: vi.fn().mockResolvedValue(undefined),
  deleteNote: vi.fn().mockResolvedValue(undefined),
  noteTagColors: ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'],
}

describe('QuickNotesDrawer', () => {
  it('renders notes and filters by search', async () => {
    const user = userEvent.setup()
    render(<QuickNotesDrawer {...baseProps} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Alpha note')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/search notes or use #tag/i), 'missing')
    expect(screen.queryByText('Alpha note')).not.toBeInTheDocument()
  })

  it('creates a note from the add button', async () => {
    const user = userEvent.setup()
    const addNote = vi.fn().mockResolvedValue(undefined)
    render(<QuickNotesDrawer {...baseProps} addNote={addNote} />)

    await user.click(screen.getByRole('button', { name: /create note/i }))
    expect(addNote).toHaveBeenCalled()
  })
})
