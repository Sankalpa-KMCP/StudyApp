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
    render(<Sidebar {...baseProps} />)
    expect(screen.getByText('Study Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Getting Started Tour')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collapse sidebar', hidden: true })).toBeInTheDocument()
  })

  it('collapses to icon rail and persists preference in localStorage', async () => {
    const user = userEvent.setup()
    render(<Sidebar {...baseProps} />)

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar', hidden: true }))

    expect(localStorage.getItem('sidebar_collapsed')).toBe('true')
    expect(screen.queryByText('Study Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('Getting Started Tour')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand sidebar', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Focus', hidden: true })).toBeInTheDocument()
  })

  it('expands from icon rail and clears collapsed preference', async () => {
    localStorage.setItem('sidebar_collapsed', 'true')
    const user = userEvent.setup()
    render(<Sidebar {...baseProps} />)

    expect(screen.queryByText('Study Dashboard')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Expand sidebar', hidden: true }))

    expect(localStorage.getItem('sidebar_collapsed')).toBe('false')
    expect(screen.getByText('Study Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Getting Started Tour')).toBeInTheDocument()
  })
})
