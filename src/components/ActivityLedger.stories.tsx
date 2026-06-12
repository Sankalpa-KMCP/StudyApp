import type { Meta, StoryObj } from '@storybook/react-vite'
import { ActivityLedger } from './ActivityLedger'

const meta: Meta<typeof ActivityLedger> = {
  title: 'Features/ActivityLedger',
  component: ActivityLedger,
}

export default meta
type Story = StoryObj<typeof ActivityLedger>

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export const Default: Story = {
  render: () => (
    <div className="p-6 max-w-4xl" style={{ background: '#0a0b10' }}>
      <ActivityLedger
        selectedDay={10}
        setSelectedDay={() => {}}
        currentMonth={5}
        currentYear={2026}
        monthNames={monthNames}
        dayNames={dayNames}
        goPrevMonth={() => {}}
        goNextMonth={() => {}}
        calendarCategoryFilter="all"
        setCalendarCategoryFilter={() => {}}
        categories={[]}
        activeThemeVars={{ accentBlue: '#3B82F6', accentAmber: '#F59E0B' }}
        dynamicGridCells={Array.from({ length: 35 }, (_, i) => (i < 5 ? null : i - 4))}
        activeMonthData={[]}
        isLiveMonth
        totalDaysInMonth={30}
        todayDayOfMonth={10}
        todayStudyMinutes={90}
        todayBreakMinutes={15}
        progressPercent={45}
        liveDay={{ date: 10, dayName: 'Tue', studyTime: '1h 30m', breakTime: '15m', focusRatio: '85%', sessionsCompleted: '3', focusScore: '4.2', intensity: 2 }}
        initialDraftMood="focused"
        handleMoodSelect={() => {}}
        initialDraftNotes=""
        handleNotesChange={() => {}}
        selectedDayHistory={[]}
        saveStatus="idle"
      />
    </div>
  ),
}
