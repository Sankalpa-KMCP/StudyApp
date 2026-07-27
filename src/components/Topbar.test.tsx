import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Topbar } from './Topbar'
import type { SearchResult } from '../appUtils'

describe('Topbar quick add', () => {
  const baseProps = {
    activeView: 'Home' as const,
    search: '',
    searchResults: [] as SearchResult[],
    noticeOpen: false,
    noticePopoverId: 'notice-popover',
    onSearch: () => undefined,
    onClearSearch: () => undefined,
    onSelectSearchResult: () => undefined,
    onToggleNotices: () => undefined,
    onCloseNotices: () => undefined,
    onOpenProfile: () => undefined,
    onQuickAdd: () => undefined,
  }

  it('keeps quick-add and notifications mutually exclusive', async () => {
    const user = userEvent.setup()
    const onCloseNotices = vi.fn()
    const onToggleNotices = vi.fn()
    const { rerender } = render(
      <Topbar {...baseProps} onCloseNotices={onCloseNotices} onToggleNotices={onToggleNotices} />,
    )

    await user.click(screen.getByRole('button', { name: 'Quick add' }))
    expect(onCloseNotices).toHaveBeenCalled()
    expect(screen.getByRole('menu', { name: 'Quick add' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(onToggleNotices).toHaveBeenCalled()
    expect(screen.queryByRole('menu', { name: 'Quick add' })).not.toBeInTheDocument()

    rerender(
      <Topbar
        {...baseProps}
        noticeOpen
        onCloseNotices={onCloseNotices}
        onToggleNotices={onToggleNotices}
      />,
    )
    expect(screen.queryByRole('menu', { name: 'Quick add' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notifications' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('does not conflict with profile navigation', async () => {
    const user = userEvent.setup()
    const onOpenProfile = vi.fn()
    const onQuickAdd = vi.fn()
    render(<Topbar {...baseProps} onOpenProfile={onOpenProfile} onQuickAdd={onQuickAdd} />)

    await user.click(screen.getByRole('button', { name: 'Quick add' }))
    await user.click(screen.getByRole('button', { name: 'Profile' }))
    expect(onOpenProfile).toHaveBeenCalled()
    expect(onQuickAdd).not.toHaveBeenCalled()
  })

  it('forwards menu selection to onQuickAdd', async () => {
    const user = userEvent.setup()
    const onQuickAdd = vi.fn()
    render(<Topbar {...baseProps} onQuickAdd={onQuickAdd} />)

    await user.click(screen.getByRole('button', { name: 'Quick add' }))
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Note' }))
    expect(onQuickAdd).toHaveBeenCalledWith('note')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('Topbar global search', () => {
  const results: SearchResult[] = [
    { id: 't1', type: 'Task', title: 'Alpha task', meta: 'General - open', view: 'Tasks' },
    { id: 'n1', type: 'Note', title: 'Alpha note', meta: 'General', view: 'Notes' },
  ]

  const baseProps = {
    activeView: 'Home' as const,
    search: '',
    searchResults: [] as SearchResult[],
    noticeOpen: false,
    noticePopoverId: 'notice-popover',
    onSearch: () => undefined,
    onClearSearch: () => undefined,
    onSelectSearchResult: () => undefined,
    onToggleNotices: () => undefined,
    onCloseNotices: () => undefined,
    onOpenProfile: () => undefined,
    onQuickAdd: () => undefined,
  }

  it('stays closed with an empty query and opens when typing', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    const { rerender } = render(<Topbar {...baseProps} onSearch={onSearch} />)

    const search = screen.getByRole('combobox', { name: 'Search' })
    expect(search).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    await user.type(search, 'a')
    expect(onSearch).toHaveBeenCalled()
    rerender(<Topbar {...baseProps} search="a" searchResults={results} onSearch={onSearch} />)
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('supports Down/Up/Home/End/Enter and Escape dismissal', async () => {
    const user = userEvent.setup()
    const onSelectSearchResult = vi.fn()
    const onClearSearch = vi.fn()
    render(
      <Topbar
        {...baseProps}
        search="alpha"
        searchResults={results}
        onSelectSearchResult={onSelectSearchResult}
        onClearSearch={onClearSearch}
      />,
    )

    const search = screen.getByRole('combobox', { name: 'Search' })
    await user.click(search)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Task.*Alpha task/i })).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: /Note.*Alpha note/i })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Home}')
    expect(screen.getByRole('option', { name: /Task.*Alpha task/i })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{End}')
    expect(screen.getByRole('option', { name: /Note.*Alpha note/i })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Enter}')
    expect(onSelectSearchResult).toHaveBeenCalledWith(results[1])
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    await user.tab()
    expect(search).not.toHaveFocus()
    await user.click(search)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onClearSearch).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(onClearSearch).toHaveBeenCalled()
  })

  it('shows no-results state and clears the query from the clear control', async () => {
    const user = userEvent.setup()
    const onClearSearch = vi.fn()
    render(
      <Topbar
        {...baseProps}
        search="zzzz"
        searchResults={[]}
        onClearSearch={onClearSearch}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Search' }))
    expect(screen.getByText('No matches found')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onClearSearch).toHaveBeenCalled()
  })

  it('keeps search disabled and closed when searchEnabled is false', () => {
    render(<Topbar {...baseProps} search="stale" searchResults={results} searchEnabled={false} />)
    const search = screen.getByRole('combobox', { name: 'Search' })
    expect(search).toBeDisabled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('focuses search with / and opens results when a query already exists', async () => {
    const user = userEvent.setup()
    render(<Topbar {...baseProps} search="alpha" searchResults={results} />)

    await user.click(document.body)
    await user.keyboard('/')
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveFocus()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })
})
