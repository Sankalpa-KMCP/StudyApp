import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Topbar } from './Topbar'

describe('Topbar quick add', () => {
  const baseProps = {
    activeView: 'Home' as const,
    search: '',
    noticeOpen: false,
    noticePopoverId: 'notice-popover',
    onSearch: () => undefined,
    onClearSearch: () => undefined,
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
