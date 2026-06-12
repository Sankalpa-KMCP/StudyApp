import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppContentHeader } from '../AppContentHeader'

describe('AppContentHeader', () => {
  const baseProps = {
    activeTab: 'focus' as const,
    isTimerActive: false,
    timerMode: 'study' as const,
    todayStudyMinutes: 30,
    dailyGoalMinutes: 120,
    currentStreak: 5,
    level: 3,
    xpProgressPercent: 42,
    enforceLockout: false,
  }

  it('shows mobile streak and level stats', () => {
    render(
      <AppContentHeader
        {...baseProps}
        onNavigateToAnalytics={vi.fn()}
        onOpenHotkeys={vi.fn()}
        onOpenCommandPalette={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/5-day streak/i)).toBeInTheDocument()
    expect(screen.getByText('LVL 3')).toBeInTheDocument()
  })

  it('navigates to analytics when stats chip is clicked', async () => {
    const user = userEvent.setup()
    const onNavigateToAnalytics = vi.fn()
    render(
      <AppContentHeader
        {...baseProps}
        onNavigateToAnalytics={onNavigateToAnalytics}
        onOpenHotkeys={vi.fn()}
        onOpenCommandPalette={vi.fn()}
      />,
    )
    await user.click(screen.getByLabelText(/5-day streak/i))
    expect(onNavigateToAnalytics).toHaveBeenCalledTimes(1)
  })

  it('shows lockout strip on mobile when focus lockout is active', () => {
    render(
      <AppContentHeader
        {...baseProps}
        isTimerActive
        enforceLockout
        onNavigateToAnalytics={vi.fn()}
        onOpenHotkeys={vi.fn()}
        onOpenCommandPalette={vi.fn()}
      />,
    )
    expect(screen.getByText(/Pause the timer to leave Focus/i)).toBeInTheDocument()
  })
})
