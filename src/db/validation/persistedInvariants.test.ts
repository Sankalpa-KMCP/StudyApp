import { describe, expect, it } from 'vitest'
import {
  isPersistedGoalProgress,
  isPersistedGoalTarget,
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
})
