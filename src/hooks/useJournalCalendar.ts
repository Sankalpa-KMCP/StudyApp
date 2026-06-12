import { useState, useMemo, useRef, useEffect } from 'react'
import { updateDailyReflection, useHistoryForMonth, useMonthLogsQuery } from '../db/hooks'
import { calculateCalendarHeatmapData } from '../lib/studyDashboard'
import { useCalendarData } from './useCalendarData'
import type { TaskItem } from '../db/types'

export type JournalSaveStatus = 'idle' | 'saving' | 'saved'

interface UseJournalCalendarOptions {
  sessionTasks: TaskItem[]
  dailyGoalMinutes: number
  studyBlockDurationMinutes: number
  todayStudyMinutes: number
  todayBreakMinutes: number
}

export function useJournalCalendar({
  sessionTasks,
  dailyGoalMinutes,
  studyBlockDurationMinutes,
  todayStudyMinutes,
  todayBreakMinutes,
}: UseJournalCalendarOptions) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())
  const [calendarCategoryFilter, setCalendarCategoryFilter] = useState<'all' | number>('all')
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate())
  const [saveStatus, setSaveStatus] = useState<JournalSaveStatus>('idle')

  const [prevSelectedDateStr, setPrevSelectedDateStr] = useState<string | undefined>(undefined)
  const [prevDayLog, setPrevDayLog] = useState<unknown>(undefined)

  const notesRef = useRef('')
  const moodRef = useRef('')
  const dateStrRef = useRef('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { monthLogs, totalMonthHours } = useMonthLogsQuery(
    currentMonth,
    currentYear,
    studyBlockDurationMinutes,
  )

  const { history: monthHistory } = useHistoryForMonth(currentYear, currentMonth)

  const categoryDayMinutes = useMemo(
    () => calculateCalendarHeatmapData(monthHistory, currentMonth, currentYear, calendarCategoryFilter),
    [monthHistory, currentMonth, currentYear, calendarCategoryFilter],
  )

  const calendar = useCalendarData({
    monthLogs,
    totalMonthHours,
    sessionHistory: monthHistory,
    sessionTasks,
    currentMonth,
    currentYear,
    selectedDay,
    dailyGoalMinutes,
    todayStudyMinutes,
    todayBreakMinutes,
    categoryDayMinutes,
  })

  if (calendar.selectedDateStr !== prevSelectedDateStr || calendar.selectedDayLog !== prevDayLog) {
    setPrevSelectedDateStr(calendar.selectedDateStr)
    setPrevDayLog(calendar.selectedDayLog)
    setSaveStatus('idle')
  }

  const markSaved = () => {
    setSaveStatus('saved')
    if (savedIdleTimerRef.current) clearTimeout(savedIdleTimerRef.current)
    savedIdleTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1500)
  }

  useEffect(() => {
    const prevDate = dateStrRef.current
    const nextDate = calendar.selectedDateStr
    if (prevDate && prevDate !== nextDate && saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
      void updateDailyReflection(prevDate, notesRef.current, moodRef.current)
    }
    dateStrRef.current = nextDate
    notesRef.current = calendar.selectedDayLog?.notes ?? ''
    moodRef.current = calendar.selectedDayLog?.mood ?? ''
  }, [calendar.selectedDateStr, calendar.selectedDayLog])

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (savedIdleTimerRef.current) clearTimeout(savedIdleTimerRef.current)
  }, [])

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
    setSaveStatus('saving')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    const dateStr = calendar.selectedDateStr
    saveTimerRef.current = setTimeout(() => {
      void updateDailyReflection(dateStr, notesRef.current, moodRef.current).then(markSaved)
    }, 500)
  }

  function handleMoodSelect(mood: string) {
    const newMood = mood === moodRef.current ? '' : mood
    moodRef.current = newMood
    setSaveStatus('saving')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    void updateDailyReflection(calendar.selectedDateStr, notesRef.current, newMood).then(markSaved)
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
    saveStatus,
    calendar,
  }
}
