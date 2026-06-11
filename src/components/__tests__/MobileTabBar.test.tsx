import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileTabBar } from '../MobileTabBar'
import { NAV_TABS } from '../../navigation/appNav'

const baseProps = {
  activeTab: 'focus' as const,
  setActiveTab: vi.fn(),
  isTimerActive: false,
  timerMode: 'study' as const,
  enforceLockout: false,
}

describe('MobileTabBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all shared nav tabs', () => {
    render(<MobileTabBar {...baseProps} />)
    for (const tab of NAV_TABS) {
      expect(screen.getByRole('button', { name: tab.label })).toBeInTheDocument()
    }
  })

  it('applies accent data attributes on active tab', () => {
    render(<MobileTabBar {...baseProps} activeTab="cards" />)
    const cardsButton = screen.getByRole('button', { name: 'Cards' })
    expect(cardsButton).toHaveAttribute('data-accent', 'cards')
    expect(cardsButton).toHaveAttribute('data-active', 'true')
    expect(cardsButton).toHaveClass('mobile-nav-btn')
  })

  it('shows due-count badge on Cards tab when cardsDueCount > 0', () => {
    render(<MobileTabBar {...baseProps} cardsDueCount={3} />)
    const cardsButton = screen.getByRole('button', { name: 'Cards, 3 due for review' })
    expect(cardsButton).toBeInTheDocument()
    expect(cardsButton).toHaveTextContent('3')
  })
})
