import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useJournalCalendar } from '../useJournalCalendar'
import { resetDatabase } from '../../test/dbTestUtils'
import * as hooks from '../../db/hooks'

const baseOptions = {
  sessionTasks: [],
  dailyGoalMinutes: 480,
  studyBlockDurationMinutes: 25,
  todayStudyMinutes: 0,
  todayBreakMinutes: 0,
}

describe('useJournalCalendar', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('navigates months with goPrevMonth and goNextMonth', () => {
    const { result } = renderHook(() => useJournalCalendar(baseOptions))

    const startMonth = result.current.currentMonth
    const startYear = result.current.currentYear

    act(() => result.current.goNextMonth())
    const nextMonth = (startMonth + 1) % 12
    const nextYear = startMonth === 11 ? startYear + 1 : startYear
    expect(result.current.currentMonth).toBe(nextMonth)
    expect(result.current.currentYear).toBe(nextYear)

    act(() => result.current.goPrevMonth())
    expect(result.current.currentMonth).toBe(startMonth)
    expect(result.current.currentYear).toBe(startYear)
  })

  it('transitions saveStatus when notes change', async () => {
    vi.spyOn(hooks, 'updateDailyReflection').mockResolvedValue(undefined)

    const { result } = renderHook(() => useJournalCalendar(baseOptions))

    act(() => result.current.handleNotesChange('Test note'))
    expect(result.current.saveStatus).toBe('saving')

    await waitFor(() => expect(result.current.saveStatus).toBe('saved'), { timeout: 2000 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
})
