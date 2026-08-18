import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GlobalSearchResults } from './GlobalSearchResults'
import type { SearchResult } from '../appUtils'

const sampleResults: SearchResult[] = [
  { id: 't1', type: 'Task', title: 'Review notes', meta: 'Biology - open', view: 'Tasks' },
  { id: 'n1', type: 'Note', title: 'Mitosis', meta: 'Biology', view: 'Notes' },
  { id: 's1', type: 'Subject', title: 'Biology', meta: '40% progress', view: 'Subjects' },
]

describe('GlobalSearchResults', () => {
  it('renders populated options with type and metadata', () => {
    render(
      <GlobalSearchResults
        id="search-list"
        query="bio"
        results={sampleResults}
        activeIndex={0}
        onHoverIndex={() => undefined}
        onSelect={() => undefined}
      />,
    )

    const listbox = screen.getByRole('listbox')
    expect(listbox).toHaveAccessibleName(/3 matches for "bio"/i)
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(screen.getByRole('option', { name: /Task.*Review notes/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows a no-results state for empty matches', () => {
    render(
      <GlobalSearchResults
        id="search-list"
        query="zzzz"
        results={[]}
        activeIndex={0}
        onHoverIndex={() => undefined}
        onSelect={() => undefined}
      />,
    )

    expect(screen.getByRole('listbox')).toHaveAccessibleName(/No matches for "zzzz"/i)
    expect(screen.getByText('No matches found')).toBeInTheDocument()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('selects on mouse down without requiring a click after blur', () => {
    const onSelect = vi.fn()
    render(
      <GlobalSearchResults
        id="search-list"
        query="bio"
        results={sampleResults}
        activeIndex={1}
        onHoverIndex={() => undefined}
        onSelect={onSelect}
      />,
    )

    fireEvent.mouseDown(screen.getByRole('option', { name: /Note.*Mitosis/i }))
    expect(onSelect).toHaveBeenCalledWith(sampleResults[1])
  })

  it('updates the active option on hover', async () => {
    const user = userEvent.setup()
    const onHoverIndex = vi.fn()
    render(
      <GlobalSearchResults
        id="search-list"
        query="bio"
        results={sampleResults}
        activeIndex={0}
        onHoverIndex={onHoverIndex}
        onSelect={() => undefined}
      />,
    )

    await user.hover(screen.getByRole('option', { name: /Subject.*Biology/i }))
    expect(onHoverIndex).toHaveBeenCalledWith(2)
  })
})
