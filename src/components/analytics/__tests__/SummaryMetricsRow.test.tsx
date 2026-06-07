import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SummaryMetricsRow } from '../SummaryMetricsRow'

describe('SummaryMetricsRow', () => {
  it('renders summary metric labels', () => {
    render(
      <SummaryMetricsRow
        monthLogs={[{ dateString: '2025-06-01', studyMinutes: 60, breakMinutes: 0 }]}
        totalMonthHours={1}
        totalWeeklyBreakHours={0.5}
        totalDaysInMonth={30}
        currentStreak={3}
      />,
    )
    expect(screen.getByText('Monthly Study Time')).toBeInTheDocument()
    expect(screen.getByText('Streak Status')).toBeInTheDocument()
    expect(screen.getByText('3 Days')).toBeInTheDocument()
  })
})
