import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MobileNavigation } from './MobileNavigation'

describe('MobileNavigation', () => {
  it('renders five primary destinations with visible labels', () => {
    render(<MobileNavigation activeView="Home" onNavigate={() => undefined} />)
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(nav).getByRole('button', { name: 'Home' })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Tasks' })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Notes' })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Progress' })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'More' })).toBeInTheDocument()
    expect(within(nav).queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('marks the active primary route with aria-current', () => {
    render(<MobileNavigation activeView="Tasks" onNavigate={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Tasks' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('marks More active when a secondary route is current and identifies it in the menu', async () => {
    const user = userEvent.setup()
    render(<MobileNavigation activeView="Settings" onNavigate={() => undefined} />)
    expect(screen.getByRole('button', { name: 'More' })).toHaveClass('is-active')
    await user.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('menuitem', { name: 'Subjects' })).not.toHaveAttribute('aria-current')
  })

  it('keeps More closed initially and opens by pointer and keyboard', async () => {
    const user = userEvent.setup()
    render(<MobileNavigation activeView="Home" onNavigate={() => undefined} />)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('menu', { name: 'More destinations' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Subjects' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(screen.getByRole('menu', { name: 'More destinations' })).toBeInTheDocument()
  })

  it('closes More on Escape with focus return and on outside dismissal', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <button type="button">Outside</button>
        <MobileNavigation activeView="Home" onNavigate={() => undefined} />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('navigates primary and secondary destinations and closes More after selection', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<MobileNavigation activeView="Home" onNavigate={onNavigate} />)

    await user.click(screen.getByRole('button', { name: 'Progress' }))
    expect(onNavigate).toHaveBeenCalledWith('Progress')

    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('menuitem', { name: 'Calendar' }))
    expect(onNavigate).toHaveBeenCalledWith('Calendar')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('exposes every secondary destination label', async () => {
    const user = userEvent.setup()
    render(<MobileNavigation activeView="Home" onNavigate={() => undefined} />)
    await user.click(screen.getByRole('button', { name: 'More' }))
    for (const label of ['Subjects', 'Calendar', 'Flashcards', 'Goals', 'Settings'] as const) {
      expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument()
    }
  })

  it('supports repeated open and close cycles', async () => {
    const user = userEvent.setup()
    render(<MobileNavigation activeView="Home" onNavigate={() => undefined} />)
    const more = screen.getByRole('button', { name: 'More' })
    await user.click(more)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await user.click(more)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
