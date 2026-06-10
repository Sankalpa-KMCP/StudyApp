import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppContentHeader } from '../AppContentHeader'

describe('AppContentHeader', () => {
  it('shows simplified mobile goal chip label', () => {
    render(
      <AppContentHeader
        activeTab="focus"
        currentStreak={3}
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
        currentStreak={1}
        isTimerActive
        timerMode="study"
        todayStudyMinutes={0}
        dailyGoalMinutes={120}
      />,
    )
    expect(screen.getAllByText('Study timer running')).toHaveLength(2)
  })
})
