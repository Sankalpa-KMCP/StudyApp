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
    expect(container.querySelector('.sidebar-indicator')).toBeInTheDocument()
  })

  it('collapses to icon rail and persists preference in localStorage', async () => {
    const user = userEvent.setup()
    render(<Sidebar {...baseProps} />)

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar', hidden: true }))

    expect(localStorage.getItem('sidebar_collapsed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Expand sidebar', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Focus', hidden: true })).toBeInTheDocument()
  })

  it('hides sliding indicator and renders flyout labels when collapsed', async () => {
    const user = userEvent.setup()
    const { container } = render(<Sidebar {...baseProps} />)

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar', hidden: true }))

    expect(container.querySelector('.sidebar-indicator')).not.toBeInTheDocument()
    const hiddenBrand = screen.getByText('Study Dashboard').parentElement
    expect(hiddenBrand).toHaveClass('opacity-0')
    expect(hiddenBrand).toHaveClass('max-w-0')
    const flyouts = [...container.querySelectorAll('span[aria-hidden="true"]')].filter(
      el => el.className.includes('glass-panel'),
    )
    expect(flyouts.length).toBeGreaterThan(0)
    expect(flyouts.some(el => el.textContent === 'Focus')).toBe(true)
  })

  it('expands from icon rail and clears collapsed preference', async () => {
    localStorage.setItem('sidebar_collapsed', 'true')
    const user = userEvent.setup()
    const { container } = render(<Sidebar {...baseProps} />)

    expect(container.querySelector('.sidebar-indicator')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Expand sidebar', hidden: true }))

    expect(localStorage.getItem('sidebar_collapsed')).toBe('false')
    expect(screen.getByText('Study Dashboard')).toBeVisible()
    expect(screen.getByText('Getting Started Tour')).toBeVisible()
    expect(container.querySelector('.sidebar-indicator')).toBeInTheDocument()
  })
})
