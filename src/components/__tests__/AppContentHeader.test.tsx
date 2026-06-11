import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppContentHeader } from '../AppContentHeader'

describe('AppContentHeader', () => {
  it('shows simplified goal chip label', () => {
    render(
      <AppContentHeader
        activeTab="focus"
        isTimerActive={false}
        timerMode="study"
        todayStudyMinutes={30}
        dailyGoalMinutes={120}
      />,
    )
    expect(screen.getAllByText('1h 30m left today').length).toBeGreaterThanOrEqual(1)
  })

  it('shows timer running status on mobile when active', () => {
    render(
      <AppContentHeader
        activeTab="focus"
        isTimerActive
        timerMode="study"
        todayStudyMinutes={0}
        dailyGoalMinutes={120}
      />,
    )
    expect(screen.getAllByText('Study timer running')).toHaveLength(2)
  })

  it('does not show streak chip in header', () => {
    render(
      <AppContentHeader
        activeTab="focus"
        isTimerActive={false}
        timerMode="study"
        todayStudyMinutes={0}
        dailyGoalMinutes={120}
      />,
    )
    expect(screen.queryByText(/day streak/i)).not.toBeInTheDocument()
  })
})
