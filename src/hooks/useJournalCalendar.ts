import { useState, useMemo, useRef, useEffect } from 'react'
import { updateDailyReflection, useMonthLogsQuery } from '../db/hooks'
import { calculateCalendarHeatmapData } from '../lib/studyDashboard'
import { useCalendarData } from './useCalendarData'
import type { CategoryItem, DailyLog, HistoryEntry, TaskItem } from '../db/types'

interface UseJournalCalendarOptions {
  sessionHistory: HistoryEntry[]
  sessionTasks: TaskItem[]
  allLogs: DailyLog[]
  categories: CategoryItem[]
  dailyGoalMinutes: number
  studyBlockDurationMinutes: number
  todayStudyMinutes: number
  todayBreakMinutes: number
}

export function useJournalCalendar({
  sessionHistory,
  sessionTasks,
  categories,
  dailyGoalMinutes,
  studyBlockDurationMinutes,
  todayStudyMinutes,
  todayBreakMinutes,
}: UseJournalCalendarOptions) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())
  const [calendarCategoryFilter, setCalendarCategoryFilter] = useState<'all' | number>('all')
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate())

  const notesRef = useRef('')
  const moodRef = useRef('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { monthLogs, totalMonthHours } = useMonthLogsQuery(
    currentMonth,
    currentYear,
    studyBlockDurationMinutes,
  )

  const categoryDayMinutes = useMemo(
    () => calculateCalendarHeatmapData(sessionHistory, currentMonth, currentYear, calendarCategoryFilter),
    [sessionHistory, currentMonth, currentYear, calendarCategoryFilter],
  )

  const calendar = useCalendarData({
    monthLogs,
    totalMonthHours,
    sessionHistory,
    sessionTasks,
    currentMonth,
    currentYear,
    selectedDay,
    dailyGoalMinutes,
    studyBlockDurationMinutes,
    todayStudyMinutes,
    todayBreakMinutes,
    categoryDayMinutes,
  })

  useEffect(() => {
    notesRef.current = calendar.selectedDayLog?.notes ?? ''
    moodRef.current = calendar.selectedDayLog?.mood ?? ''
  }, [calendar.selectedDateStr, calendar.selectedDayLog])

  function goPrevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(y => y - 1)
    } else {
      setCurrentMonth(m => m - 1)
    }
  }

  function goNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(y => y + 1)
    } else {
      setCurrentMonth(m => m + 1)
    }
  }

  function handleNotesChange(value: string) {
    notesRef.current = value
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      updateDailyReflection(calendar.selectedDateStr, notesRef.current, moodRef.current)
    }, 500)
  }

  function handleMoodSelect(mood: string) {
    const newMood = mood === moodRef.current ? '' : mood
    moodRef.current = newMood
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    updateDailyReflection(calendar.selectedDateStr, notesRef.current, newMood)
  }

  return {
    currentMonth,
    currentYear,
    selectedDay,
    setSelectedDay,
    calendarCategoryFilter,
    setCalendarCategoryFilter,
    goPrevMonth,
    goNextMonth,
    handleNotesChange,
    handleMoodSelect,
    calendar,
  }
}
