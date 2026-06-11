import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from '../Sidebar'
import type { SidebarProps } from '../sidebar/types'
import { SidebarCollapseProvider } from '../sidebar/SidebarCollapseContext'

const baseProps: SidebarProps = {
  isZenMode: false,
  currentStreak: 5,
  level: 3,
  xpProgressPercent: 42,
  activeTab: 'focus',
  setActiveTab: vi.fn(),
  setIsHotkeyHudOpen: vi.fn(),
  isTimerActive: false,
  timerMode: 'study' as const,
  enforceLockout: false,
  onToggleNotes: vi.fn(),
  onShowOnboarding: vi.fn(),
}

function renderSidebar(props = baseProps) {
  return render(
    <SidebarCollapseProvider>
      <Sidebar {...props} />
    </SidebarCollapseProvider>,
  )
}

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders expanded by default when localStorage is empty', () => {
    const { container } = renderSidebar()
    expect(screen.getByText('Study Dash')).toBeVisible()
    expect(screen.getByText('Getting Started Tour')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Collapse sidebar', hidden: true })).toBeInTheDocument()
    const shell = container.querySelector('.sidebar-shell')
    expect(shell).toBeInTheDocument()
    expect(shell).toHaveAttribute('data-collapsed', 'false')
    expect(shell).toHaveClass('sidebar-shell--expanded')
  })

  it('collapses to icon rail and persists preference in localStorage', async () => {
    const user = userEvent.setup()
    const { container } = renderSidebar()
    const shell = container.querySelector('.sidebar-shell')
    expect(shell).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar', hidden: true }))

    await waitFor(() => {
      expect(localStorage.getItem('sidebar_collapsed')).toBe('true')
      expect(shell).toHaveAttribute('data-collapsed', 'true')
    })
    expect(container.querySelector('.sidebar-shell')).toBe(shell)
    expect(screen.getByRole('button', { name: 'Expand sidebar', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Focus', hidden: true })).toBeInTheDocument()
  })

  it('renders rail with grid-centered nav and no inline labels when collapsed', async () => {
    const user = userEvent.setup()
    const { container } = renderSidebar()

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar', hidden: true }))

    const shell = container.querySelector('.sidebar-shell')
    await waitFor(() => {
      expect(shell).toHaveAttribute('data-collapsed', 'true')
    })

    expect(shell).toHaveClass('sidebar-shell--rail')
    expect(container.querySelector('.sidebar-indicator')).not.toBeInTheDocument()

    const nav = shell?.querySelector('nav')
    expect(nav).toHaveClass('justify-items-center')

    const focusButton = screen.getByRole('button', { name: 'Focus', hidden: true })
    expect(focusButton).toHaveClass('h-10')
    expect(focusButton).toHaveClass('w-10')
    expect(focusButton).toHaveAttribute('data-active', 'true')
    expect(focusButton.querySelectorAll('span')).toHaveLength(0)
    expect(focusButton.querySelector('svg')).toBeInTheDocument()
  })

  it('uses square centered nav buttons when collapsed with active tab', () => {
    localStorage.setItem('sidebar_collapsed', 'true')
    const { container } = renderSidebar({ ...baseProps, activeTab: 'cards' })

    const shell = container.querySelector('.sidebar-shell')
    const nav = shell?.querySelector('nav')
    expect(nav).toHaveClass('justify-items-center')

    const cardsButton = screen.getByRole('button', { name: 'Cards', hidden: true })
    expect(cardsButton).toHaveClass('h-10')
    expect(cardsButton).toHaveClass('w-10')
    expect(cardsButton).toHaveAttribute('data-active', 'true')
    expect(cardsButton).toHaveAttribute('data-accent', 'cards')
    expect(cardsButton.querySelectorAll('span:not([aria-hidden="true"])')).toHaveLength(0)
    expect(cardsButton.querySelector('svg')).toBeInTheDocument()
  })

  it('expands from icon rail and clears collapsed preference', async () => {
    localStorage.setItem('sidebar_collapsed', 'true')
    const user = userEvent.setup()
    const { container } = renderSidebar()
    const shell = container.querySelector('.sidebar-shell')

    expect(shell).toHaveAttribute('data-collapsed', 'true')

    await user.click(screen.getByRole('button', { name: 'Expand sidebar', hidden: true }))

    await waitFor(() => {
      expect(localStorage.getItem('sidebar_collapsed')).toBe('false')
      expect(shell).toHaveAttribute('data-collapsed', 'false')
    })
    expect(container.querySelector('.sidebar-shell')).toBe(shell)
    expect(screen.getByText('Study Dash')).toBeVisible()
    expect(screen.getByText('Getting Started Tour')).toBeVisible()
    expect(container.querySelector('.nav-tab[data-active="true"]')).toBeInTheDocument()
  })
})
