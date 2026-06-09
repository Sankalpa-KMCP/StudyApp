import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from '../Sidebar'

const baseProps = {
  isZenMode: false,
  currentStreak: 5,
  level: 3,
  xpProgressPercent: 42,
  activeTab: 'focus' as const,
  setActiveTab: vi.fn(),
  setIsHotkeyHudOpen: vi.fn(),
  isTimerActive: false,
  timerMode: 'study' as const,
  enforceLockout: false,
  onToggleNotes: vi.fn(),
  onShowOnboarding: vi.fn(),
}

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders expanded by default when localStorage is empty', () => {
    const { container } = render(<Sidebar {...baseProps} />)
    expect(screen.getByText('Study Dashboard')).toBeVisible()
    expect(screen.getByText('Getting Started Tour')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Collapse sidebar', hidden: true })).toBeInTheDocument()
    expect(container.querySelector('[data-collapsed="false"]')).toBeInTheDocument()
    expect(container.querySelector('.sidebar-shell--expanded')).toBeInTheDocument()
  })

  it('collapses to icon rail and persists preference in localStorage', async () => {
    const user = userEvent.setup()
    render(<Sidebar {...baseProps} />)

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar', hidden: true }))

    expect(localStorage.getItem('sidebar_collapsed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Expand sidebar', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Focus', hidden: true })).toBeInTheDocument()
    expect(document.querySelector('[data-collapsed="true"]')).toBeInTheDocument()
  })

  it('renders rail with grid-centered nav and no inline labels when collapsed', async () => {
    const user = userEvent.setup()
    const { container } = render(<Sidebar {...baseProps} />)

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar', hidden: true }))

    const rail = container.querySelector('[data-collapsed="true"]')
    expect(rail).toBeInTheDocument()
    expect(rail).toHaveClass('sidebar-shell--rail')
    expect(container.querySelector('.sidebar-indicator')).not.toBeInTheDocument()

    const nav = rail?.querySelector('nav')
    expect(nav).toHaveClass('justify-items-center')

    const focusButton = screen.getByRole('button', { name: 'Focus', hidden: true })
    expect(focusButton).toHaveClass('h-10')
    expect(focusButton).toHaveClass('w-10')
    expect(focusButton.querySelectorAll('span')).toHaveLength(0)
    expect(focusButton.querySelector('svg')).toBeInTheDocument()
  })

  it('uses square centered nav buttons when collapsed with active tab', () => {
    localStorage.setItem('sidebar_collapsed', 'true')
    const { container } = render(<Sidebar {...baseProps} activeTab="cards" />)

    const rail = container.querySelector('[data-collapsed="true"]')
    const nav = rail?.querySelector('nav')
    expect(nav).toHaveClass('justify-items-center')

    const cardsButton = screen.getByRole('button', { name: 'Cards', hidden: true })
    expect(cardsButton).toHaveClass('h-10')
    expect(cardsButton).toHaveClass('w-10')
    expect(cardsButton.querySelectorAll('span:not([aria-hidden="true"])')).toHaveLength(0)
    expect(cardsButton.querySelector('svg')).toBeInTheDocument()
  })

  it('expands from icon rail and clears collapsed preference', async () => {
    localStorage.setItem('sidebar_collapsed', 'true')
    const user = userEvent.setup()
    const { container } = render(<Sidebar {...baseProps} />)

    expect(container.querySelector('[data-collapsed="true"]')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Expand sidebar', hidden: true }))

    expect(localStorage.getItem('sidebar_collapsed')).toBe('false')
    expect(screen.getByText('Study Dashboard')).toBeVisible()
    expect(screen.getByText('Getting Started Tour')).toBeVisible()
    expect(container.querySelector('[data-collapsed="false"]')).toBeInTheDocument()
    expect(container.querySelector('.nav-tab.active')).toBeInTheDocument()
  })
})
