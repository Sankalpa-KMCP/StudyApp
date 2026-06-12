import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCalendarData } from '../useCalendarData'

describe('useCalendarData', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses today day-of-month for liveDay when selected day is today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 12, 14, 30, 0))

    const { result } = renderHook(() =>
      useCalendarData({
        monthLogs: [],
        totalMonthHours: 0,
        sessionHistory: [],
        sessionTasks: [],
        currentMonth: 5,
        currentYear: 2026,
        selectedDay: 12,
        dailyGoalMinutes: 120,
        todayStudyMinutes: 45,
        todayBreakMinutes: 10,
        categoryDayMinutes: null,
      }),
    )

    expect(result.current.liveDay.studyTime).toBe('0h 45m')
    expect(result.current.liveDay.breakTime).toBe('0h 10m')
    expect(result.current.todayDayOfMonth).toBe(12)
  })

  it('does not treat last day of month as today when today is mid-month', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 12, 14, 30, 0))

    const { result } = renderHook(() =>
      useCalendarData({
        monthLogs: [],
        totalMonthHours: 0,
        sessionHistory: [],
        sessionTasks: [],
        currentMonth: 5,
        currentYear: 2026,
        selectedDay: 30,
        dailyGoalMinutes: 120,
        todayStudyMinutes: 45,
        todayBreakMinutes: 10,
        categoryDayMinutes: null,
      }),
    )

    expect(result.current.liveDay.studyTime).toBe('0h 0m')
  })

  it('does not apply live today data when selected day is not today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 12, 14, 30, 0))

    const { result } = renderHook(() =>
      useCalendarData({
        monthLogs: [{ dateString: '2026-06-10', studyMinutes: 20, breakMinutes: 5 }],
        totalMonthHours: 0,
        sessionHistory: [],
        sessionTasks: [],
        currentMonth: 5,
        currentYear: 2026,
        selectedDay: 10,
        dailyGoalMinutes: 120,
        todayStudyMinutes: 45,
        todayBreakMinutes: 10,
        categoryDayMinutes: null,
      }),
    )

    expect(result.current.liveDay.studyTime).toBe('0h 20m')
    expect(result.current.liveDay.breakTime).toBe('0h 5m')
  })
})
