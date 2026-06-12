import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityLedger } from '../ActivityLedger'
import { MONTH_NAMES, DAY_NAMES_SHORT } from '../../lib/theme'

const theme = { accentBlue: '#3b82f6', accentAmber: '#f59e0b' }

const liveDay = {
  date: 10,
  dayName: 'Tue',
  studyTime: '0m',
  breakTime: '0m',
  focusRatio: '0%',
  sessionsCompleted: '0',
  focusScore: '0%',
  intensity: 0 as const,
}

const baseProps = {
  selectedDay: 10,
  setSelectedDay: vi.fn(),
  currentMonth: 5,
  currentYear: 2026,
  monthNames: MONTH_NAMES,
  dayNames: DAY_NAMES_SHORT,
  goPrevMonth: vi.fn(),
  goNextMonth: vi.fn(),
  calendarCategoryFilter: 'all' as const,
  setCalendarCategoryFilter: vi.fn(),
  categories: [],
  activeThemeVars: theme,
  dynamicGridCells: [1, 2, 3],
  activeMonthData: [],
  isLiveMonth: true,
  totalDaysInMonth: 30,
  todayDayOfMonth: 10,
  todayStudyMinutes: 0,
  todayBreakMinutes: 0,
  progressPercent: 0,
  liveDay,
  initialDraftMood: '',
  handleMoodSelect: vi.fn(),
  initialDraftNotes: '',
  handleNotesChange: vi.fn(),
  selectedDayHistory: [],
  saveStatus: 'idle' as const,
}

describe('ActivityLedger', () => {
  it('renders day journal section', () => {
    render(<ActivityLedger {...baseProps} />)
    expect(screen.getByText('Day journal')).toBeInTheDocument()
  })

  it('selects a mood when mood button is clicked', async () => {
    const user = userEvent.setup()
    const handleMoodSelect = vi.fn()
    render(<ActivityLedger {...baseProps} handleMoodSelect={handleMoodSelect} />)
    await user.click(screen.getByRole('button', { name: /focused/i }))
    expect(handleMoodSelect).toHaveBeenCalledWith('focused')
  })

  it('updates reflection notes on textarea input', async () => {
    const user = userEvent.setup()
    const handleNotesChange = vi.fn()
    render(<ActivityLedger {...baseProps} handleNotesChange={handleNotesChange} />)
    const textarea = screen.getByPlaceholderText(/how did you perform/i)
    await user.type(textarea, 'Good day')
    expect(handleNotesChange).toHaveBeenCalled()
    expect(handleNotesChange.mock.calls.some(call => String(call[0]).includes('Good'))).toBe(true)
  })
})
