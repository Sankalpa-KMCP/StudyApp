import { describe, it, expect } from 'vitest'
import { getNextRecurrenceDate } from '../recurrence'

describe('getNextRecurrenceDate', () => {
  it('returns null when rule is undefined', () => {
    expect(getNextRecurrenceDate(undefined)).toBeNull()
  })

  it('advances one day for daily rule', () => {
    const from = new Date('2026-06-22T12:00:00')
    const next = getNextRecurrenceDate('daily', from)
    expect(next?.getDate()).toBe(23)
    expect(next?.getMonth()).toBe(5)
  })

  it('advances seven days for weekly rule', () => {
    const from = new Date('2026-06-22T12:00:00')
    const next = getNextRecurrenceDate('weekly', from)
    expect(next?.getDate()).toBe(29)
  })

  it('skips weekends for weekdays rule', () => {
    const friday = new Date('2026-06-19T12:00:00')
    const next = getNextRecurrenceDate('weekdays', friday)
    expect(next?.getDay()).toBe(1)
    expect(next?.getDate()).toBe(22)
  })
})
