import { useMemo } from 'react'
import type { DailyLog, HistoryEntry, TaskItem, CategoryItem } from '../db/types'
import type { DayData } from '../types/app'
import { formatMinutes, getIntensity, getHistoryDayKey } from '../lib/studyDashboard'
import { DAY_NAMES_SHORT, MONTH_NAMES } from '../lib/theme'

interface UseCalendarDataOptions {
  allLogs: DailyLog[]
  sessionHistory: HistoryEntry[]
  sessionTasks: TaskItem[]
  categories: CategoryItem[]
  currentMonth: number
  currentYear: number
  selectedDay: number
  calendarCategoryFilter: 'all' | number
  dailyGoalMinutes: number
  studyBlockDurationMinutes: number
  todayStudyMinutes: number
  todayBreakMinutes: number
  categoryDayMinutes: Map<number, number> | null
}

export function useCalendarData({
  allLogs,
  sessionHistory,
  sessionTasks,
  currentMonth,
  currentYear,
  selectedDay,
  dailyGoalMinutes,
  todayStudyMinutes,
  todayBreakMinutes,
  categoryDayMinutes,
}: UseCalendarDataOptions) {
  const monthLogsData = useMemo(() => {
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-`
    const monthLogs = allLogs.filter(log => log.dateString.startsWith(prefix))
    const totalMonthHours = monthLogs.reduce((sum, log) => sum + (log.studyMinutes || 0) / 60, 0)
    return {
      monthLogs,
      totalMonthHours: Number.parseFloat(totalMonthHours.toFixed(1)) || 0,
    }
  }, [allLogs, currentMonth, currentYear])

  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay()
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const dynamicGridCells: (number | null)[] = [
    ...Array(firstDayIndex).fill(null),
    ...Array.from({ length: totalDaysInMonth }, (_, i) => i + 1),
  ]
  const isLiveMonth = currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear()
  const monthLogMap = new Map(monthLogsData.monthLogs.map(l => [parseInt(l.dateString.split('-')[2]), l]))
  const effectiveSelectedDay = Math.min(selectedDay, totalDaysInMonth)
  const selectedDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(effectiveSelectedDay).padStart(2, '0')}`
  const selectedDayLog = monthLogMap.get(effectiveSelectedDay)

  const activeMonthData: DayData[] = Array.from({ length: totalDaysInMonth }, (_, i) => {
    const date = i + 1
    const startDay = new Date(currentYear, currentMonth, date).getDay()
    const log = monthLogMap.get(date)
    const studyMin = categoryDayMinutes !== null
      ? (categoryDayMinutes.get(date) ?? 0)
      : (log?.studyMinutes ?? 0)
    const bgBreakMin = log?.breakMinutes ?? 0
    const total = studyMin + bgBreakMin
    const focusRatio = total > 0 ? Math.round((studyMin / total) * 100) : 0
    return {
      date,
      dayName: DAY_NAMES_SHORT[startDay],
      studyTime: formatMinutes(studyMin),
      breakTime: formatMinutes(bgBreakMin),
      focusRatio: `${focusRatio}%`,
      sessionsCompleted: '0',
      focusScore: `${Math.min(Math.round((studyMin / dailyGoalMinutes) * 100), 100)}%`,
      intensity: getIntensity(studyMin),
    }
  })

  const progress = dailyGoalMinutes > 0 ? Math.min(todayStudyMinutes / dailyGoalMinutes, 1) : 0
  const progressPercent = Math.round(progress * 100)
  const todaySessionsDone = sessionTasks.filter(t => t.completed).length
  const totalSessionsTarget = sessionTasks.length
  const isLastDay = selectedDay === totalDaysInMonth

  const liveDay = isLiveMonth && isLastDay
    ? {
        ...activeMonthData[selectedDay - 1],
        studyTime: formatMinutes(todayStudyMinutes),
        breakTime: formatMinutes(todayBreakMinutes),
        sessionsCompleted: `${todaySessionsDone} of ${totalSessionsTarget}`,
        focusScore: `${progressPercent}%`,
        intensity: getIntensity(todayStudyMinutes),
      }
    : activeMonthData[selectedDay - 1]

  const selectedDayHistory = useMemo(() => {
    return sessionHistory
      .filter(e => {
        const { month, day, year } = getHistoryDayKey(e)
        return month === currentMonth && day === selectedDay && year === currentYear
      })
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
  }, [sessionHistory, currentMonth, currentYear, selectedDay])

  const today = new Date()
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(today)
  monday.setDate(today.getDate() + mondayOffset)

  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const y = d.getFullYear()
    const m = d.getMonth()
    const dayNum = d.getDate()
    if (m === currentMonth && y === currentYear) {
      const log = monthLogMap.get(dayNum)
      return log ? { studyMin: log.studyMinutes, breakMin: log.breakMinutes } : null
    }
    return null
  })

  const hasChartData = weekData.some(d => d !== null && d.studyMin > 0) || todayStudyMinutes > 0
  const chartData = hasChartData ? weekData.map((d, i) => ({
    day: DAY_NAMES_SHORT[(monday.getDay() + i) % 7],
    hours: d ? parseFloat((d.studyMin / 60).toFixed(1)) : 0,
    focus: d ? Math.min(Math.round((d.studyMin / dailyGoalMinutes) * 100), 100) : 0,
  })) : []

  return {
    monthLogs: monthLogsData.monthLogs,
    totalMonthHours: monthLogsData.totalMonthHours,
    dynamicGridCells,
    isLiveMonth,
    totalDaysInMonth,
    selectedDateStr,
    selectedDayLog,
    activeMonthData,
    liveDay,
    selectedDayHistory,
    progressPercent,
    chartData,
    hasChartData,
    totalWeeklyBreakHours: parseFloat((todayBreakMinutes / 60).toFixed(1)),
    monthNames: MONTH_NAMES,
    dayNames: DAY_NAMES_SHORT,
  }
}
