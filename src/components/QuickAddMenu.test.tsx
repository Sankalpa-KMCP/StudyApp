import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QuickAddMenu } from './QuickAddMenu'

describe('QuickAddMenu', () => {
  it('starts closed with an accessible Quick add trigger', () => {
    render(<QuickAddMenu open={false} onOpenChange={() => undefined} onSelect={() => undefined} />)

    const trigger = screen.getByRole('button', { name: 'Quick add' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens by mouse and focuses the first item', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <QuickAddMenu open={false} onOpenChange={onOpenChange} onSelect={() => undefined} />,
    )

    await user.click(screen.getByRole('button', { name: 'Quick add' }))
    expect(onOpenChange).toHaveBeenCalledWith(true)

    rerender(<QuickAddMenu open onOpenChange={onOpenChange} onSelect={() => undefined} />)

    const menu = screen.getByRole('menu', { name: 'Quick add' })
    expect(screen.getByRole('button', { name: 'Quick add' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(menu).getByRole('menuitem', { name: 'Task' })).toHaveFocus()
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Task',
      'Note',
      'Event',
      'Flashcard',
      'Focus session',
    ])
  })

  it('activates Focus session with keyboard End and Enter', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onSelect = vi.fn()
    render(<QuickAddMenu open onOpenChange={onOpenChange} onSelect={onSelect} />)

    expect(screen.getByRole('menuitem', { name: 'Task' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('menuitem', { name: 'Focus session' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('focus')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('activates Focus session with Space and closes the menu', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onSelect = vi.fn()
    render(<QuickAddMenu open onOpenChange={onOpenChange} onSelect={onSelect} />)

    screen.getByRole('menuitem', { name: 'Focus session' }).focus()
    await user.keyboard(' ')
    expect(onSelect).toHaveBeenCalledWith('focus')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('opens by keyboard and supports arrow navigation plus Enter activation', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onSelect = vi.fn()
    const { rerender } = render(
      <QuickAddMenu open={false} onOpenChange={onOpenChange} onSelect={onSelect} />,
    )

    screen.getByRole('button', { name: 'Quick add' }).focus()
    await user.keyboard('{Enter}')
    expect(onOpenChange).toHaveBeenCalledWith(true)

    rerender(<QuickAddMenu open onOpenChange={onOpenChange} onSelect={onSelect} />)
    expect(screen.getByRole('menuitem', { name: 'Task' })).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Note' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('note')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('activates a focused item with Space', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onSelect = vi.fn()
    render(<QuickAddMenu open onOpenChange={onOpenChange} onSelect={onSelect} />)

    screen.getByRole('menuitem', { name: 'Event' }).focus()
    await user.keyboard(' ')
    expect(onSelect).toHaveBeenCalledWith('event')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('dismisses with Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <QuickAddMenu open onOpenChange={onOpenChange} onSelect={() => undefined} />,
    )

    expect(screen.getByRole('menuitem', { name: 'Task' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)

    rerender(<QuickAddMenu open={false} onOpenChange={onOpenChange} onSelect={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Quick add' })).toHaveFocus()
  })

  it('dismisses on outside click without selecting an item', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onSelect = vi.fn()
    render(
      <div>
        <button type="button">Outside</button>
        <QuickAddMenu open onOpenChange={onOpenChange} onSelect={onSelect} />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: 'Outside' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('closes after item selection and supports repeated open/select cycles', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onSelect = vi.fn()
    const { rerender } = render(
      <QuickAddMenu open={false} onOpenChange={onOpenChange} onSelect={onSelect} />,
    )

    await user.click(screen.getByRole('button', { name: 'Quick add' }))
    rerender(<QuickAddMenu open onOpenChange={onOpenChange} onSelect={onSelect} />)
    await user.click(screen.getByRole('menuitem', { name: 'Task' }))
    expect(onSelect).toHaveBeenNthCalledWith(1, 'task')
    expect(onOpenChange).toHaveBeenCalledWith(false)

    rerender(<QuickAddMenu open={false} onOpenChange={onOpenChange} onSelect={onSelect} />)
    await user.click(screen.getByRole('button', { name: 'Quick add' }))
    rerender(<QuickAddMenu open onOpenChange={onOpenChange} onSelect={onSelect} />)
    await user.click(screen.getByRole('menuitem', { name: 'Flashcard' }))
    expect(onSelect).toHaveBeenNthCalledWith(2, 'flashcard')

    rerender(<QuickAddMenu open={false} onOpenChange={onOpenChange} onSelect={onSelect} />)
    await user.click(screen.getByRole('button', { name: 'Quick add' }))
    rerender(<QuickAddMenu open onOpenChange={onOpenChange} onSelect={onSelect} />)
    await user.click(screen.getByRole('menuitem', { name: 'Focus session' }))
    expect(onSelect).toHaveBeenNthCalledWith(3, 'focus')
  })
})
