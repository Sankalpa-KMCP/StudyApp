import { lazy, Suspense } from 'react'
import { TabLoadingFallback } from '../shared/TabLoadingFallback'
import { useStudyData, useStudyJournal, useStudyUI } from '../../context/useStudyApp'

const ActivityLedger = lazy(() =>
  import('../ActivityLedger').then(m => ({ default: m.ActivityLedger }))
)

export function JournalTab() {
  const { categories } = useStudyData()
  const { activeThemeVars } = useStudyUI()
  const { journal, todayLog } = useStudyJournal()
  const { calendar } = journal

  return (
    <Suspense fallback={<TabLoadingFallback label="journal" />}>
      <ActivityLedger
        key={calendar.selectedDateStr}
        selectedDay={journal.selectedDay}
        setSelectedDay={journal.setSelectedDay}
        currentMonth={journal.currentMonth}
        currentYear={journal.currentYear}
        monthNames={calendar.monthNames}
        dayNames={calendar.dayNames}
        goPrevMonth={journal.goPrevMonth}
        goNextMonth={journal.goNextMonth}
        calendarCategoryFilter={journal.calendarCategoryFilter}
        setCalendarCategoryFilter={journal.setCalendarCategoryFilter}
        categories={categories.categories}
        activeThemeVars={activeThemeVars}
        dynamicGridCells={calendar.dynamicGridCells}
        activeMonthData={calendar.activeMonthData}
        isLiveMonth={calendar.isLiveMonth}
        totalDaysInMonth={calendar.totalDaysInMonth}
        todayStudyMinutes={todayLog.studyMinutes}
        todayBreakMinutes={todayLog.breakMinutes}
        progressPercent={calendar.progressPercent}
        liveDay={calendar.liveDay}
        initialDraftMood={calendar.selectedDayLog?.mood ?? ''}
        handleMoodSelect={journal.handleMoodSelect}
        initialDraftNotes={calendar.selectedDayLog?.notes ?? ''}
        handleNotesChange={journal.handleNotesChange}
        selectedDayHistory={calendar.selectedDayHistory}
      />
    </Suspense>
  )
}
