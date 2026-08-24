import { describe, expect, it } from 'vitest'
import {
  isPersistedDailyGoalMinutes,
  isPersistedDueDate,
  isPersistedGoalProgress,
  isPersistedGoalTarget,
  isPersistedIsoTimestamp,
  isPersistedLocalDateKey,
  isPersistedStudySessionMinutes,
  isPersistedSubjectProgress,
  isPersistedSubjectReference,
  isPersistedSubjectTargetHours,
  isPersistedTaskMinutes,
  isPersistedTimestampOrder,
} from './persistedInvariants'

describe('persistedInvariants', () => {
  describe('isPersistedSubjectProgress', () => {
    it('accepts inclusive 0–100 and rejects just outside', () => {
      expect(isPersistedSubjectProgress(0)).toBe(true)
      expect(isPersistedSubjectProgress(100)).toBe(true)
      expect(isPersistedSubjectProgress(50)).toBe(true)
      expect(isPersistedSubjectProgress(-1)).toBe(false)
      expect(isPersistedSubjectProgress(101)).toBe(false)
    })
  })

  describe('isPersistedSubjectTargetHours', () => {
    it('accepts positive values including fractions and rejects non-positive', () => {
      expect(isPersistedSubjectTargetHours(0.5)).toBe(true)
      expect(isPersistedSubjectTargetHours(1)).toBe(true)
      expect(isPersistedSubjectTargetHours(101)).toBe(true)
      expect(isPersistedSubjectTargetHours(0)).toBe(false)
      expect(isPersistedSubjectTargetHours(-2)).toBe(false)
    })
  })

  describe('isPersistedTaskMinutes', () => {
    it('accepts zero and values above the editor maximum; rejects negative', () => {
      expect(isPersistedTaskMinutes(0)).toBe(true)
      expect(isPersistedTaskMinutes(5)).toBe(true)
      expect(isPersistedTaskMinutes(720)).toBe(true)
      expect(isPersistedTaskMinutes(721)).toBe(true)
      expect(isPersistedTaskMinutes(-1)).toBe(false)
    })
  })

  describe('isPersistedStudySessionMinutes', () => {
    it('accepts positive minutes and rejects zero or negative', () => {
      expect(isPersistedStudySessionMinutes(1)).toBe(true)
      expect(isPersistedStudySessionMinutes(0)).toBe(false)
      expect(isPersistedStudySessionMinutes(-1)).toBe(false)
    })
  })

  describe('isPersistedTimestampOrder', () => {
    const earlier = '2026-07-24T11:00:00.000Z'
    const later = '2026-07-24T12:00:00.000Z'

    it('accepts equal or increasing timestamps and rejects reversed pairs', () => {
      expect(isPersistedTimestampOrder(earlier, earlier)).toBe(true)
      expect(isPersistedTimestampOrder(earlier, later)).toBe(true)
      expect(isPersistedTimestampOrder(later, earlier)).toBe(false)
    })

    it('does not reject when Date.parse yields NaN (preserves prior import behaviour)', () => {
      expect(isPersistedTimestampOrder('not-a-date', later)).toBe(true)
      expect(isPersistedTimestampOrder(earlier, 'also-bad')).toBe(true)
    })
  })

  describe('isPersistedGoalTarget', () => {
    it('accepts positive targets including above the editor maximum; rejects non-positive', () => {
      expect(isPersistedGoalTarget(1)).toBe(true)
      expect(isPersistedGoalTarget(10_000)).toBe(true)
      expect(isPersistedGoalTarget(10_001)).toBe(true)
      expect(isPersistedGoalTarget(0)).toBe(false)
      expect(isPersistedGoalTarget(-1)).toBe(false)
    })
  })

  describe('isPersistedGoalProgress', () => {
    it('accepts zero and over-target progress; rejects negative', () => {
      expect(isPersistedGoalProgress(0)).toBe(true)
      expect(isPersistedGoalProgress(50)).toBe(true)
      expect(isPersistedGoalProgress(-1)).toBe(false)
    })
  })

  describe('isPersistedSubjectReference', () => {
    const subjectIds = new Set(['subject-math'])

    it('accepts General empty id and existing ids; rejects orphans', () => {
      expect(isPersistedSubjectReference('', subjectIds)).toBe(true)
      expect(isPersistedSubjectReference('subject-math', subjectIds)).toBe(true)
      expect(isPersistedSubjectReference('missing', subjectIds)).toBe(false)
    })
  })

  describe('isPersistedDailyGoalMinutes', () => {
    it('accepts positive finite numbers including boundaries and above 720', () => {
      expect(isPersistedDailyGoalMinutes(1)).toBe(true)
      expect(isPersistedDailyGoalMinutes(25)).toBe(true)
      expect(isPersistedDailyGoalMinutes(29)).toBe(true)
      expect(isPersistedDailyGoalMinutes(30)).toBe(true)
      expect(isPersistedDailyGoalMinutes(720)).toBe(true)
      expect(isPersistedDailyGoalMinutes(721)).toBe(true)
      expect(isPersistedDailyGoalMinutes(10_000)).toBe(true)
    })

    it('rejects non-positive, non-finite, or non-numeric values', () => {
      expect(isPersistedDailyGoalMinutes(0)).toBe(false)
      expect(isPersistedDailyGoalMinutes(-1)).toBe(false)
      expect(isPersistedDailyGoalMinutes(Number.NaN)).toBe(false)
      expect(isPersistedDailyGoalMinutes(Number.POSITIVE_INFINITY)).toBe(false)
      expect(isPersistedDailyGoalMinutes('240')).toBe(false)
      expect(isPersistedDailyGoalMinutes(null)).toBe(false)
      expect(isPersistedDailyGoalMinutes(undefined)).toBe(false)
    })
  })

  describe('isPersistedLocalDateKey & isPersistedDueDate', () => {
    it('accepts valid Gregorian calendar dates', () => {
      expect(isPersistedLocalDateKey('2026-01-02')).toBe(true)
      expect(isPersistedLocalDateKey('2028-02-29')).toBe(true)
      expect(isPersistedLocalDateKey('2026-12-31')).toBe(true)
    })

    it('rejects impossible calendar dates', () => {
      expect(isPersistedLocalDateKey('2026-02-29')).toBe(false)
      expect(isPersistedLocalDateKey('2026-02-30')).toBe(false)
      expect(isPersistedLocalDateKey('2026-04-31')).toBe(false)
      expect(isPersistedLocalDateKey('2026-13-01')).toBe(false)
      expect(isPersistedLocalDateKey('2026-00-10')).toBe(false)
    })

    it('rejects non-canonical date formats', () => {
      expect(isPersistedLocalDateKey('January 2, 2026')).toBe(false)
      expect(isPersistedLocalDateKey('01/02/2026')).toBe(false)
      expect(isPersistedLocalDateKey('2026/01/02')).toBe(false)
      expect(isPersistedLocalDateKey('2026-1-2')).toBe(false)
      expect(isPersistedLocalDateKey('2026-01-02T00:00:00Z')).toBe(false)
    })

    it('handles isPersistedDueDate with empty string and invalid dates', () => {
      expect(isPersistedDueDate('')).toBe(true)
      expect(isPersistedDueDate('2026-01-02')).toBe(true)
      expect(isPersistedDueDate('2026-02-30')).toBe(false)
      expect(isPersistedDueDate(null)).toBe(false)
    })
  })

  describe('isPersistedIsoTimestamp', () => {
    it('accepts canonical toISOString() format with exactly 3 millisecond digits', () => {
      expect(isPersistedIsoTimestamp('2026-01-02T10:00:00.000Z')).toBe(true)
      expect(isPersistedIsoTimestamp('2026-01-02T10:00:00.001Z')).toBe(true)
      expect(isPersistedIsoTimestamp('2026-01-02T10:00:00.500Z')).toBe(true)
      expect(isPersistedIsoTimestamp('2028-02-29T23:59:59.999Z')).toBe(true)
      expect(isPersistedIsoTimestamp('2026-07-21T08:00:00.000Z')).toBe(true)
    })

    it('rejects no-millisecond or non-3-digit millisecond timestamps', () => {
      expect(isPersistedIsoTimestamp('2026-01-02T10:00:00Z')).toBe(false)
      expect(isPersistedIsoTimestamp('2026-01-02T10:00:00.0Z')).toBe(false)
      expect(isPersistedIsoTimestamp('2026-01-02T10:00:00.00Z')).toBe(false)
      expect(isPersistedIsoTimestamp('2026-01-02T10:00:00.0000Z')).toBe(false)
    })

    it('rejects impossible dates and times in timestamps', () => {
      expect(isPersistedIsoTimestamp('2026-02-29T10:00:00.000Z')).toBe(false)
      expect(isPersistedIsoTimestamp('2026-02-30T10:00:00.000Z')).toBe(false)
      expect(isPersistedIsoTimestamp('2026-04-31T10:00:00.000Z')).toBe(false)
      expect(isPersistedIsoTimestamp('2026-13-01T10:00:00.000Z')).toBe(false)
      expect(isPersistedIsoTimestamp('2026-01-02T24:00:00.000Z')).toBe(false)
      expect(isPersistedIsoTimestamp('2026-01-02T10:60:00.000Z')).toBe(false)
      expect(isPersistedIsoTimestamp('2026-01-02T10:00:60.000Z')).toBe(false)
    })

    it('rejects non-canonical timestamp formats, non-UTC timezones, and casing/whitespace variants', () => {
      expect(isPersistedIsoTimestamp('2026-01-02T10:00:00.000+00:00')).toBe(false)
      expect(isPersistedIsoTimestamp('2026-01-02T10:00:00+02:00')).toBe(false)
      expect(isPersistedIsoTimestamp('2026-01-02T12:00:00.000+02:00')).toBe(false)
      expect(isPersistedIsoTimestamp('2026-01-02T10:00:00.000')).toBe(false)
      expect(isPersistedIsoTimestamp('2026-01-02 10:00:00')).toBe(false)
      expect(isPersistedIsoTimestamp(' 2026-01-02T10:00:00.000Z')).toBe(false)
      expect(isPersistedIsoTimestamp('2026-01-02T10:00:00.000Z ')).toBe(false)
      expect(isPersistedIsoTimestamp('2026-01-02t10:00:00.000z')).toBe(false)
      expect(isPersistedIsoTimestamp('January 2, 2026 10:00:00 UTC')).toBe(false)
      expect(isPersistedIsoTimestamp('01/02/2026 10:00:00')).toBe(false)
      expect(isPersistedIsoTimestamp('not-a-date')).toBe(false)
      expect(isPersistedIsoTimestamp(123456789)).toBe(false)
      expect(isPersistedIsoTimestamp(null)).toBe(false)
    })
  })
})
