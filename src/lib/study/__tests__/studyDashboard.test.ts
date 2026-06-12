import { describe, it, expect } from 'vitest'
import {
  buildDateString,
  calculateSM2,
  calculateStreak,
  calculateXpLevel,
  validateBackupPayload,
  parseLegacyHistoryTimestamp,
  parseHistoryCreatedAt,
  getHistoryDayKey,
} from '../studyDashboard'

describe('buildDateString', () => {
  it('formats dates as YYYY-MM-DD', () => {
    expect(buildDateString(new Date(2026, 5, 10))).toBe('2026-06-10')
  })
})

describe('calculateSM2', () => {
  it('increments interval on good recall', () => {
    const result = calculateSM2(4, 0, 2.5, 0)
    expect(result.repetitionCount).toBe(1)
    expect(result.intervalDays).toBe(1)
  })

  it('resets on poor recall', () => {
    const result = calculateSM2(2, 3, 2.5, 10)
    expect(result.repetitionCount).toBe(0)
    expect(result.intervalDays).toBe(1)
  })
})

describe('calculateStreak', () => {
  it('returns 0 when no study days', () => {
    expect(calculateStreak([])).toBe(0)
  })

  it('counts consecutive days including today', () => {
    const today = buildDateString(new Date())
    const yesterday = buildDateString(new Date(Date.now() - 86400000))
    expect(calculateStreak([
      { dateString: today, studyMinutes: 30 },
      { dateString: yesterday, studyMinutes: 20 },
    ])).toBe(2)
  })
})

describe('calculateXpLevel', () => {
  it('derives level from lifetime minutes', () => {
    const result = calculateXpLevel([{ dateString: '2026-06-10', studyMinutes: 100 }])
    expect(result.level).toBe(2)
    expect(result.totalXP).toBe(1000)
  })
})

describe('validateBackupPayload', () => {
  it('accepts minimal valid payload', () => {
    expect(validateBackupPayload({
      version: 2,
      tasks: [{ text: 'Read', completed: false }],
      history: [{ timestamp: 'June 10, 14:30', type: 'study', durationMinutes: 25 }],
    })).toBe(true)
  })

  it('rejects invalid task shape', () => {
    expect(validateBackupPayload({ tasks: [{ text: 1, completed: false }] })).toBe(false)
  })

  it('rejects non-object roots and bad version', () => {
    expect(validateBackupPayload(null)).toBe(false)
    expect(validateBackupPayload([])).toBe(false)
    expect(validateBackupPayload({ version: '2' })).toBe(false)
  })

  it('validates dailyLogs settings categories flashcards and quickNotes', () => {
    expect(validateBackupPayload({
      dailyLogs: [{ dateString: '2026-06-10', studyMinutes: 1, breakMinutes: 0 }],
      settings: [{ key: 'theme', value: 'midnight-oled' }],
      categories: [{ name: 'General', color: '#000' }],
      flashcards: [{ question: 'Q', answer: 'A' }],
      quickNotes: [{ title: 'T', content: 'C' }],
    })).toBe(true)
    expect(validateBackupPayload({ dailyLogs: [{}] })).toBe(false)
    expect(validateBackupPayload({ settings: [{ key: 1, value: true }] })).toBe(false)
    expect(validateBackupPayload({ flashcards: [{ question: 1, answer: 'A' }] })).toBe(false)
    expect(validateBackupPayload({ quick_notes: [{ title: 'T', content: 1 }] })).toBe(false)
  })

  it('rejects invalid history entries', () => {
    expect(validateBackupPayload({
      history: [{ timestamp: 'x', type: 'invalid', durationMinutes: 1 }],
    })).toBe(false)
    expect(validateBackupPayload({
      history: [{ timestamp: 'x', type: 'study', durationMinutes: 1, createdAt: 'bad' }],
    })).toBe(false)
  })
})

describe('history timestamp helpers', () => {
  it('parses legacy timestamp strings', () => {
    const ts = parseLegacyHistoryTimestamp('June 10, 14:30')
    const d = new Date(ts)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(10)
    expect(d.getHours()).toBe(14)
    expect(d.getMinutes()).toBe(30)
  })

  it('prefers createdAt when present', () => {
    const createdAt = Date.UTC(2026, 0, 15, 10, 0)
    expect(parseHistoryCreatedAt({
      timestamp: 'January 1, 10:00',
      type: 'study',
      durationMinutes: 25,
      createdAt,
    })).toBe(createdAt)
  })

  it('extracts day key from entry', () => {
    const createdAt = new Date(2026, 2, 5, 12, 0).getTime()
    const key = getHistoryDayKey({
      timestamp: 'ignored',
      type: 'study',
      durationMinutes: 25,
      createdAt,
    })
    expect(key).toEqual({ month: 2, day: 5, year: 2026 })
  })

  it('falls back to legacy timestamp when createdAt missing', () => {
    const ts = parseHistoryCreatedAt({
      timestamp: 'March 5, 12:00',
      type: 'study',
      durationMinutes: 25,
    })
    expect(new Date(ts).getMonth()).toBe(2)
  })
})

describe('calculateStreak edge cases', () => {
  it('returns 0 when latest day has no study minutes', () => {
    const today = buildDateString(new Date())
    expect(calculateStreak([{ dateString: today, studyMinutes: 0 }])).toBe(0)
  })
})
