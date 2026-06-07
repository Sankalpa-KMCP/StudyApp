import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivityLedger } from '../ActivityLedger'
import { MONTH_NAMES, DAY_NAMES_SHORT } from '../../lib/theme'

const theme = { accentBlue: '#3b82f6', accentAmber: '#f59e0b' }

describe('ActivityLedger', () => {
  it('renders day journal section', () => {
    render(
      <ActivityLedger
        selectedDay={10}
        setSelectedDay={vi.fn()}
        currentMonth={5}
        currentYear={2026}
        monthNames={MONTH_NAMES}
        dayNames={DAY_NAMES_SHORT}
        goPrevMonth={vi.fn()}
        goNextMonth={vi.fn()}
        calendarCategoryFilter="all"
        setCalendarCategoryFilter={vi.fn()}
        categories={[]}
        activeThemeVars={theme}
        dynamicGridCells={[1, 2, 3]}
        activeMonthData={[]}
        isLiveMonth={true}
        totalDaysInMonth={30}
        todayStudyMinutes={0}
        todayBreakMinutes={0}
        progressPercent={0}
        liveDay={{
          date: 10,
          dayName: 'Tue',
          studyTime: '0m',
          breakTime: '0m',
          focusRatio: '0%',
          sessionsCompleted: '0',
          focusScore: '0%',
          intensity: 0,
        }}
        initialDraftMood=""
        handleMoodSelect={vi.fn()}
        initialDraftNotes=""
        handleNotesChange={vi.fn()}
        selectedDayHistory={[]}
      />,
    )
    expect(screen.getByText('Day Journal reflections')).toBeInTheDocument()
  })
})
