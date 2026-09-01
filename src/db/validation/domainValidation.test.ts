import { describe, expect, it } from 'vitest'
import {
  assertCalendarEventWriteFields,
  assertGoalWriteFields,
  assertNoteWriteFields,
  assertStudySessionWriteFields,
  assertSubjectWriteFields,
  assertTaskStatus,
  assertTaskWriteFields,
  DomainValidationError,
  isDomainValidationError,
  isGoalPeriod,
  isTaskPriority,
  isTaskStatus,
} from './domainValidation'
import { InvalidSubjectColorError } from '../../validation/subjectColor'

describe('Domain Validation Assertions', () => {
  describe('DomainValidationError and type guards', () => {
    it('identifies DomainValidationError instances', () => {
      const err = new DomainValidationError('title', 'Title is required')
      expect(err.name).toBe('DomainValidationError')
      expect(err.code).toBe('invalid_domain_record')
      expect(err.field).toBe('title')
      expect(isDomainValidationError(err)).toBe(true)
      expect(isDomainValidationError(new Error('Other'))).toBe(false)
      expect(isDomainValidationError({ code: 'invalid_domain_record' })).toBe(true)
    })

    it('validates enum type guards', () => {
      expect(isTaskPriority('low')).toBe(true)
      expect(isTaskPriority('normal')).toBe(true)
      expect(isTaskPriority('high')).toBe(true)
      expect(isTaskPriority('urgent')).toBe(false)
      expect(isTaskPriority(null)).toBe(false)

      expect(isTaskStatus('open')).toBe(true)
      expect(isTaskStatus('done')).toBe(true)
      expect(isTaskStatus('archived')).toBe(false)

      expect(isGoalPeriod('daily')).toBe(true)
      expect(isGoalPeriod('weekly')).toBe(true)
      expect(isGoalPeriod('monthly')).toBe(true)
      expect(isGoalPeriod('yearly')).toBe(false)
    })
  })

  describe('assertSubjectWriteFields', () => {
    const validSubject = {
      name: 'Biology',
      color: '#2563eb',
      targetHours: 10,
      progress: 50,
      progressMode: 'manual' as const,
    }

    it('accepts valid subject write fields', () => {
      expect(() => assertSubjectWriteFields(validSubject)).not.toThrow()
    })

    it('rejects blank names', () => {
      expect(() => assertSubjectWriteFields({ ...validSubject, name: '' })).toThrow(DomainValidationError)
      expect(() => assertSubjectWriteFields({ ...validSubject, name: '   ' })).toThrow(DomainValidationError)
    })

    it('rejects invalid colors via InvalidSubjectColorError', () => {
      expect(() => assertSubjectWriteFields({ ...validSubject, color: 'blue' })).toThrow(InvalidSubjectColorError)
      expect(() => assertSubjectWriteFields({ ...validSubject, color: '#zzz' })).toThrow(InvalidSubjectColorError)
    })

    it('rejects non-positive targetHours', () => {
      expect(() => assertSubjectWriteFields({ ...validSubject, targetHours: 0 })).toThrow(DomainValidationError)
      expect(() => assertSubjectWriteFields({ ...validSubject, targetHours: -5 })).toThrow(DomainValidationError)
      expect(() => assertSubjectWriteFields({ ...validSubject, targetHours: NaN })).toThrow(DomainValidationError)
    })

    it('rejects progress outside 0-100', () => {
      expect(() => assertSubjectWriteFields({ ...validSubject, progress: -1 })).toThrow(DomainValidationError)
      expect(() => assertSubjectWriteFields({ ...validSubject, progress: 101 })).toThrow(DomainValidationError)
      expect(() => assertSubjectWriteFields({ ...validSubject, progress: NaN })).toThrow(DomainValidationError)
    })

    it('rejects invalid progressMode', () => {
      expect(() => assertSubjectWriteFields({ ...validSubject, progressMode: 'invalid' as unknown as 'manual' })).toThrow(DomainValidationError)
    })
  })

  describe('assertTaskWriteFields and assertTaskStatus', () => {
    const validTask = {
      title: 'Finish Assignment',
      subjectId: 'sub-1',
      dueDate: '2026-09-01',
      priority: 'normal' as const,
      minutes: 45,
    }

    it('accepts valid task fields', () => {
      expect(() => assertTaskWriteFields(validTask)).not.toThrow()
      expect(() => assertTaskWriteFields({ ...validTask, dueDate: '', minutes: 0 })).not.toThrow()
    })

    it('rejects blank titles', () => {
      expect(() => assertTaskWriteFields({ ...validTask, title: '' })).toThrow(DomainValidationError)
      expect(() => assertTaskWriteFields({ ...validTask, title: '  \t ' })).toThrow(DomainValidationError)
    })

    it('rejects invalid dueDate', () => {
      expect(() => assertTaskWriteFields({ ...validTask, dueDate: 'not-a-date' })).toThrow(DomainValidationError)
      expect(() => assertTaskWriteFields({ ...validTask, dueDate: '2026-02-30' })).toThrow(DomainValidationError)
    })

    it('rejects invalid priority', () => {
      expect(() => assertTaskWriteFields({ ...validTask, priority: 'critical' as unknown as 'normal' })).toThrow(DomainValidationError)
    })

    it('rejects negative minutes', () => {
      expect(() => assertTaskWriteFields({ ...validTask, minutes: -1 })).toThrow(DomainValidationError)
      expect(() => assertTaskWriteFields({ ...validTask, minutes: NaN })).toThrow(DomainValidationError)
    })

    it('validates task status', () => {
      expect(() => assertTaskStatus('open')).not.toThrow()
      expect(() => assertTaskStatus('done')).not.toThrow()
      expect(() => assertTaskStatus('pending' as unknown as 'open')).toThrow(DomainValidationError)
    })
  })

  describe('assertNoteWriteFields', () => {
    const validNote = {
      title: 'Lecture Notes',
      body: 'Important concepts...',
      subjectId: 'sub-1',
      tags: ['exam', 'ch1'],
    }

    it('accepts valid note fields', () => {
      expect(() => assertNoteWriteFields(validNote)).not.toThrow()
      expect(() => assertNoteWriteFields({ ...validNote, body: '', tags: [] })).not.toThrow()
    })

    it('rejects blank titles', () => {
      expect(() => assertNoteWriteFields({ ...validNote, title: '' })).toThrow(DomainValidationError)
      expect(() => assertNoteWriteFields({ ...validNote, title: '   ' })).toThrow(DomainValidationError)
    })

    it('rejects non-string body or non-array tags', () => {
      expect(() => assertNoteWriteFields({ ...validNote, body: 123 as unknown as string })).toThrow(DomainValidationError)
      expect(() => assertNoteWriteFields({ ...validNote, tags: 'tag1' as unknown as string[] })).toThrow(DomainValidationError)
      expect(() => assertNoteWriteFields({ ...validNote, tags: [123] as unknown as string[] })).toThrow(DomainValidationError)
    })
  })

  describe('assertCalendarEventWriteFields', () => {
    const validEvent = {
      title: 'Final Exam',
      subjectId: 'sub-1',
      startAt: '2026-08-20T10:00:00.000Z',
      endAt: '2026-08-20T12:00:00.000Z',
      location: 'Hall A',
    }

    it('accepts valid event fields', () => {
      expect(() => assertCalendarEventWriteFields(validEvent)).not.toThrow()
    })

    it('rejects blank titles', () => {
      expect(() => assertCalendarEventWriteFields({ ...validEvent, title: '' })).toThrow(DomainValidationError)
      expect(() => assertCalendarEventWriteFields({ ...validEvent, title: '   ' })).toThrow(DomainValidationError)
    })

    it('rejects invalid or non-canonical timestamps', () => {
      expect(() => assertCalendarEventWriteFields({ ...validEvent, startAt: 'invalid-date' })).toThrow(DomainValidationError)
      expect(() => assertCalendarEventWriteFields({ ...validEvent, endAt: '2026-08-20' })).toThrow(DomainValidationError)
    })

    it('rejects inverted timestamps (endAt < startAt)', () => {
      expect(() => assertCalendarEventWriteFields({
        ...validEvent,
        startAt: '2026-08-20T12:00:00.000Z',
        endAt: '2026-08-20T10:00:00.000Z',
      })).toThrow(DomainValidationError)
    })
  })

  describe('assertGoalWriteFields', () => {
    const validGoal = {
      title: 'Study 10 Hours',
      target: 600,
      progress: 120,
      period: 'weekly' as const,
      metric: 'study_time' as const,
    }

    it('accepts valid goal fields', () => {
      expect(() => assertGoalWriteFields(validGoal)).not.toThrow()
      // Manual progress exceeding target is valid in domain persistence
      expect(() => assertGoalWriteFields({ ...validGoal, target: 10, progress: 15, metric: 'manual' })).not.toThrow()
    })

    it('rejects blank titles', () => {
      expect(() => assertGoalWriteFields({ ...validGoal, title: '' })).toThrow(DomainValidationError)
      expect(() => assertGoalWriteFields({ ...validGoal, title: '   ' })).toThrow(DomainValidationError)
    })

    it('rejects non-positive targets', () => {
      expect(() => assertGoalWriteFields({ ...validGoal, target: 0 })).toThrow(DomainValidationError)
      expect(() => assertGoalWriteFields({ ...validGoal, target: -10 })).toThrow(DomainValidationError)
      expect(() => assertGoalWriteFields({ ...validGoal, target: NaN })).toThrow(DomainValidationError)
    })

    it('rejects negative progress', () => {
      expect(() => assertGoalWriteFields({ ...validGoal, progress: -1 })).toThrow(DomainValidationError)
      expect(() => assertGoalWriteFields({ ...validGoal, progress: NaN })).toThrow(DomainValidationError)
    })

    it('rejects invalid period or metric', () => {
      expect(() => assertGoalWriteFields({ ...validGoal, period: 'biweekly' as unknown as 'weekly' })).toThrow(DomainValidationError)
      expect(() => assertGoalWriteFields({ ...validGoal, metric: 'points' as unknown as 'manual' })).toThrow(DomainValidationError)
    })
  })

  describe('assertStudySessionWriteFields', () => {
    const validSession = {
      subjectId: 'sub-1',
      startedAt: '2026-08-20T10:00:00.000Z',
      endedAt: '2026-08-20T10:45:00.000Z',
      minutes: 45,
      note: 'Focused study',
    }

    it('accepts valid session fields', () => {
      expect(() => assertStudySessionWriteFields(validSession)).not.toThrow()
    })

    it('rejects non-positive minutes', () => {
      expect(() => assertStudySessionWriteFields({ ...validSession, minutes: 0 })).toThrow(DomainValidationError)
      expect(() => assertStudySessionWriteFields({ ...validSession, minutes: -10 })).toThrow(DomainValidationError)
      expect(() => assertStudySessionWriteFields({ ...validSession, minutes: NaN })).toThrow(DomainValidationError)
    })

    it('rejects invalid timestamps or inverted timestamps', () => {
      expect(() => assertStudySessionWriteFields({ ...validSession, startedAt: 'not-iso' })).toThrow(DomainValidationError)
      expect(() => assertStudySessionWriteFields({
        ...validSession,
        startedAt: '2026-08-20T11:00:00.000Z',
        endedAt: '2026-08-20T10:00:00.000Z',
      })).toThrow(DomainValidationError)
    })
  })
})
