import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityCalendarGrid } from '../ActivityCalendarGrid'
import { MONTH_NAMES, DAY_NAMES_SHORT } from '../../../lib/theme/theme'

const theme = { accentBlue: '#3b82f6', accentAmber: '#f59e0b' }

const liveDay = {
  date: 2,
  dayName: 'Mon',
  studyTime: '0m',
  breakTime: '0m',
  focusRatio: '0%',
  sessionsCompleted: '0',
  focusScore: '0%',
  intensity: 0 as const,
}

describe('ActivityCalendarGrid', () => {
  const baseProps = {
    selectedDay: 2,
    setSelectedDay: vi.fn(),
    currentMonth: 5,
    currentYear: 2026,
    monthNames: MONTH_NAMES,
    dayNames: DAY_NAMES_SHORT,
    dynamicGridCells: [null, null, 1, 2, 3],
    activeMonthData: [],
    isLiveMonth: true,
    todayDayOfMonth: 3,
    todayStudyMinutes: 0,
    todayBreakMinutes: 0,
    progressPercent: 0,
    liveDay,
    activeThemeVars: theme,
  }

  it('renders the study calendar grid', () => {
    render(<ActivityCalendarGrid {...baseProps} />)
    expect(screen.getByRole('grid', { name: 'June 2026 study calendar' })).toBeInTheDocument()
  })

  it('selects a day when a grid cell is clicked', async () => {
    const user = userEvent.setup()
    const setSelectedDay = vi.fn()
    render(<ActivityCalendarGrid {...baseProps} setSelectedDay={setSelectedDay} />)

    await user.click(screen.getByRole('gridcell', { name: 'June 2, 2026, focus 0m' }))
    expect(setSelectedDay).toHaveBeenCalledWith(2)
  })
})
