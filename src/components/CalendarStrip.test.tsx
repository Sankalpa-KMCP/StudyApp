import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { CalendarEvent } from '../db/types'
import { localDateKey } from '../appUtils'
import { CalendarStrip } from './CalendarStrip'
import { getCalendarStripDays } from './calendarStripDays'

/**
 * Deterministic local YYYY-MM-DD for an instant under a fixed timezone offset.
 * `timezoneOffsetMinutes` matches `Date#getTimezoneOffset` sign:
 * negative = east of UTC (e.g. -330 for UTC+5:30), positive = west (e.g. 300 for UTC-5).
 * Mechanism: shift the UTC instant by the offset, then read UTC calendar fields —
 * those fields equal the local calendar fields in that zone. Does not use the host TZ.
 */
function localDateKeyAtOffset(value: string | Date, timezoneOffsetMinutes: number) {
  const ms = (value instanceof Date ? value : new Date(value)).getTime()
  if (Number.isNaN(ms)) return ''
  const shifted = new Date(ms - timezoneOffsetMinutes * 60_000)
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`
}

function eventFixture(overrides: Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'startAt'>): CalendarEvent {
  return {
    title: 'Study block',
    subjectId: 'subj-1',
    endAt: overrides.startAt,
    location: '',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('CalendarStrip local calendar days', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('characterizes UTC-ahead and UTC-behind near-midnight local keys vs ISO UTC prefixes', () => {
    // UTC+5:30 early morning: local Jul 23 00:30 → ISO still on Jul 22 UTC
    const aheadIso = '2026-07-22T19:00:00.000Z'
    expect(aheadIso.slice(0, 10)).toBe('2026-07-22')
    expect(localDateKeyAtOffset(aheadIso, -330)).toBe('2026-07-23')

    // UTC-5 evening: local Jul 23 20:00 → ISO already on Jul 24 UTC
    const behindIso = '2026-07-24T01:00:00.000Z'
    expect(behindIso.slice(0, 10)).toBe('2026-07-24')
    expect(localDateKeyAtOffset(behindIso, 300)).toBe('2026-07-23')
  })

  it('counts a UTC-ahead near-midnight event on the local strip day, not the ISO UTC prefix day', () => {
    const toDayKey = (value: string | Date) => localDateKeyAtOffset(value, -330)
    // Local "now" = Jul 23 00:30 in UTC+5:30
    const now = new Date('2026-07-22T19:00:00.000Z')
    const startAt = '2026-07-22T19:15:00.000Z' // local Jul 23 00:45
    expect(startAt.slice(0, 10)).toBe('2026-07-22')
    expect(toDayKey(startAt)).toBe('2026-07-23')
    expect(toDayKey(now)).toBe('2026-07-23')

    const days = getCalendarStripDays([eventFixture({ id: 'evt-ahead', startAt })], now, toDayKey)

    expect(days[0]?.key).toBe('2026-07-23')
    expect(days[0]?.count).toBe(1)
    expect(days.find((day) => day.key === '2026-07-22')?.count ?? 0).toBe(0)
  })

  it('counts a UTC-behind near-midnight event on the local strip day, not the ISO UTC prefix day', () => {
    const toDayKey = (value: string | Date) => localDateKeyAtOffset(value, 300)
    // Local "now" = Jul 23 20:00 in UTC-5
    const now = new Date('2026-07-24T01:00:00.000Z')
    const startAt = '2026-07-24T01:30:00.000Z' // local Jul 23 20:30
    expect(startAt.slice(0, 10)).toBe('2026-07-24')
    expect(toDayKey(startAt)).toBe('2026-07-23')
    expect(toDayKey(now)).toBe('2026-07-23')

    const days = getCalendarStripDays([eventFixture({ id: 'evt-behind', startAt })], now, toDayKey)

    expect(days[0]?.key).toBe('2026-07-23')
    expect(days[0]?.count).toBe(1)
    expect(days.find((day) => day.key === '2026-07-24')?.count ?? 0).toBe(0)
  })

  it('defaults to production localDateKey for day identity and event matching', () => {
    vi.useFakeTimers()
    const now = new Date(2026, 6, 13, 15, 0)
    vi.setSystemTime(now)

    const localStart = new Date(2026, 6, 13, 9, 0)
    const startAt = localStart.toISOString()
    const days = getCalendarStripDays([eventFixture({ id: 'evt-local', startAt })], now)

    expect(days).toHaveLength(7)
    expect(days[0]?.key).toBe(localDateKey(now))
    expect(days[0]?.count).toBe(1)
    expect(localDateKey(startAt)).toBe(localDateKey(localStart))
    expect(days[0]?.key).toBe(localDateKey(localStart))

    for (let index = 0; index < 7; index += 1) {
      const date = new Date(now)
      date.setDate(now.getDate() + index)
      expect(days[index]?.key).toBe(localDateKey(date))
    }
  })

  it('renders accessible strip markup with corrected local-day event counts', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))

    const startAt = new Date(2026, 6, 13, 10, 0).toISOString()
    render(<CalendarStrip events={[eventFixture({ id: 'evt-ui', title: 'Lab', startAt })]} />)

    const labeled = screen.getByLabelText('Seven day calendar')
    const todayCell = within(labeled).getAllByRole('article')[0]
    expect(todayCell).toHaveClass('calendar-day', 'has-events')
    expect(within(todayCell!).getByText('1 event')).toBeInTheDocument()
    expect(within(todayCell!).getByText(String(new Date(2026, 6, 13, 15, 0).getDate()))).toBeInTheDocument()
  })
})
