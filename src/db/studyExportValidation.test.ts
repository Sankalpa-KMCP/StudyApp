import { describe, expect, it } from 'vitest'
import { ACTIVE_FOCUS_SESSION_KEY } from './activeFocusSession'
import {
  assertStudyExportRecordCounts,
  assertStudyExportRecordCountTotals,
  assertStudyExportSemantics,
  assertStudyExportSettingsValues,
  assertStudyExportSubjectReferences,
  assertUniqueStudyExportIdentifiers,
  STUDY_EXPORT_IMPORT_VALIDATION_ERROR,
} from './studyExportValidation'
import { STUDY_EXPORT_RECORD_LIMITS, type StudyExportRecordLimits } from './studyExportLimits'
import type { StudyExport } from './types'

const timestamp = '2026-07-24T00:00:00.000Z'

function emptyTables(): Omit<StudyExport, 'version' | 'exportedAt'> {
  return {
    tasks: [],
    subjects: [],
    notes: [],
    events: [],
    flashcards: [],
    studySessions: [],
    goals: [],
    settings: [],
  }
}

describe('assertUniqueStudyExportIdentifiers', () => {
  it('accepts unique ids within each table and matching ids across tables', () => {
    expect(() => assertUniqueStudyExportIdentifiers({
      ...emptyTables(),
      subjects: [{
        id: 'shared-id',
        name: 'Math',
        color: '#111827',
        targetHours: 1,
        progress: 0,
        progressMode: 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      tasks: [{
        id: 'shared-id',
        title: 'Task',
        subjectId: '',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: 30,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      notes: [{
        id: 'shared-id',
        title: 'Note',
        body: '',
        subjectId: '',
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      settings: [
        { key: 'dailyGoalMinutes', value: 240 },
        { key: 'quickNotes', value: [] },
      ],
    })).not.toThrow()
  })

  it('rejects duplicate ids within subjects, tasks, notes, events, flashcards, sessions, and goals', () => {
    const cases: Array<{ label: string; patch: Partial<ReturnType<typeof emptyTables>> }> = [
      {
        label: 'subjects',
        patch: {
          subjects: [
            {
              id: 'dup',
              name: 'A',
              color: '#111827',
              targetHours: 1,
              progress: 0,
              progressMode: 'manual',
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            {
              id: 'dup',
              name: 'B',
              color: '#111827',
              targetHours: 1,
              progress: 0,
              progressMode: 'manual',
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
        },
      },
      {
        label: 'tasks',
        patch: {
          tasks: [
            {
              id: 'dup',
              title: 'A',
              subjectId: '',
              dueDate: '',
              priority: 'normal',
              status: 'open',
              minutes: 30,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            {
              id: 'dup',
              title: 'B',
              subjectId: '',
              dueDate: '',
              priority: 'normal',
              status: 'open',
              minutes: 30,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
        },
      },
      {
        label: 'notes',
        patch: {
          notes: [
            {
              id: 'dup',
              title: 'A',
              body: '',
              subjectId: '',
              tags: [],
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            {
              id: 'dup',
              title: 'B',
              body: '',
              subjectId: '',
              tags: [],
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
        },
      },
      {
        label: 'events',
        patch: {
          events: [
            {
              id: 'dup',
              title: 'A',
              subjectId: '',
              startAt: timestamp,
              endAt: timestamp,
              location: '',
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            {
              id: 'dup',
              title: 'B',
              subjectId: '',
              startAt: timestamp,
              endAt: timestamp,
              location: '',
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
        },
      },
      {
        label: 'flashcards',
        patch: {
          flashcards: [
            {
              id: 'dup',
              front: 'A',
              back: 'A',
              subjectId: '',
              status: 'new',
              lastReviewedAt: '',
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            {
              id: 'dup',
              front: 'B',
              back: 'B',
              subjectId: '',
              status: 'new',
              lastReviewedAt: '',
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
        },
      },
      {
        label: 'studySessions',
        patch: {
          studySessions: [
            {
              id: 'dup',
              subjectId: '',
              startedAt: timestamp,
              endedAt: timestamp,
              minutes: 10,
              note: '',
            },
            {
              id: 'dup',
              subjectId: '',
              startedAt: timestamp,
              endedAt: timestamp,
              minutes: 20,
              note: '',
            },
          ],
        },
      },
      {
        label: 'goals',
        patch: {
          goals: [
            {
              id: 'dup',
              title: 'A',
              target: 10,
              progress: 0,
              period: 'daily',
              metric: 'manual',
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            {
              id: 'dup',
              title: 'B',
              target: 10,
              progress: 0,
              period: 'daily',
              metric: 'manual',
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
        },
      },
    ]

    for (const { patch } of cases) {
      expect(() => assertUniqueStudyExportIdentifiers({ ...emptyTables(), ...patch }))
        .toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
    }
  })

  it('rejects duplicate settings keys without exposing values', () => {
    expect(() => assertUniqueStudyExportIdentifiers({
      ...emptyTables(),
      settings: [
        { key: 'dailyGoalMinutes', value: 120 },
        { key: 'dailyGoalMinutes', value: 999 },
      ],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
  })
})

describe('assertStudyExportSubjectReferences', () => {
  const subject = {
    id: 'subject-math',
    name: 'Math',
    color: '#111827',
    targetHours: 1,
    progress: 0,
    progressMode: 'manual' as const,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const validFocus = {
    id: 'focus-1',
    subjectId: 'subject-math',
    startedAt: timestamp,
    plannedMinutes: 25,
    status: 'running' as const,
    pausedAt: null,
    accumulatedPausedMs: 0,
  }

  it('accepts empty-string General subjectIds and linked ids present in subjects', () => {
    expect(() => assertStudyExportSubjectReferences({
      ...emptyTables(),
      subjects: [subject],
      tasks: [{
        id: 'task-1',
        title: 'Linked',
        subjectId: 'subject-math',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: 30,
        createdAt: timestamp,
        updatedAt: timestamp,
      }, {
        id: 'task-general',
        title: 'General',
        subjectId: '',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: 30,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      notes: [{
        id: 'note-1',
        title: 'Note',
        body: '',
        subjectId: '',
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      events: [{
        id: 'event-1',
        title: 'Event',
        subjectId: 'subject-math',
        startAt: timestamp,
        endAt: timestamp,
        location: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      flashcards: [{
        id: 'card-1',
        front: 'Q',
        back: 'A',
        subjectId: '',
        status: 'new',
        lastReviewedAt: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      studySessions: [{
        id: 'session-1',
        subjectId: 'subject-math',
        startedAt: timestamp,
        endedAt: timestamp,
        minutes: 10,
        note: '',
      }],
      settings: [
        { key: ACTIVE_FOCUS_SESSION_KEY, value: validFocus },
        { key: 'futureUnknown', value: { anything: true } },
        { key: ACTIVE_FOCUS_SESSION_KEY + '-not', value: { broken: true } },
      ],
    })).not.toThrow()
  })

  it('rejects orphan subjectIds on tasks, notes, events, flashcards, and sessions', () => {
    const orphan = 'missing-subject'
    const cases: Array<Partial<ReturnType<typeof emptyTables>>> = [
      {
        tasks: [{
          id: 'task-orphan',
          title: 'Orphan',
          subjectId: orphan,
          dueDate: '',
          priority: 'normal',
          status: 'open',
          minutes: 30,
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      },
      {
        notes: [{
          id: 'note-orphan',
          title: 'Orphan',
          body: '',
          subjectId: orphan,
          tags: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      },
      {
        events: [{
          id: 'event-orphan',
          title: 'Orphan',
          subjectId: orphan,
          startAt: timestamp,
          endAt: timestamp,
          location: '',
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      },
      {
        flashcards: [{
          id: 'card-orphan',
          front: 'Q',
          back: 'A',
          subjectId: orphan,
          status: 'new',
          lastReviewedAt: '',
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      },
      {
        studySessions: [{
          id: 'session-orphan',
          subjectId: orphan,
          startedAt: timestamp,
          endedAt: timestamp,
          minutes: 10,
          note: '',
        }],
      },
    ]

    for (const patch of cases) {
      expect(() => assertStudyExportSubjectReferences({
        ...emptyTables(),
        subjects: [subject],
        ...patch,
      })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
    }
  })

  it('rejects a structurally valid activeFocusSession with an orphan subjectId', () => {
    expect(() => assertStudyExportSubjectReferences({
      ...emptyTables(),
      subjects: [subject],
      settings: [{
        key: ACTIVE_FOCUS_SESSION_KEY,
        value: { ...validFocus, subjectId: 'missing-subject' },
      }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
  })

  it('skips relationship checks for malformed activeFocusSession values', () => {
    expect(() => assertStudyExportSubjectReferences({
      ...emptyTables(),
      subjects: [subject],
      settings: [{ key: ACTIVE_FOCUS_SESSION_KEY, value: { broken: true } }],
    })).not.toThrow()
  })

  it('allows General empty subjectId on a valid activeFocusSession', () => {
    expect(() => assertStudyExportSubjectReferences({
      ...emptyTables(),
      subjects: [subject],
      settings: [{
        key: ACTIVE_FOCUS_SESSION_KEY,
        value: { ...validFocus, subjectId: '' },
      }],
    })).not.toThrow()
  })
})

describe('assertStudyExportSemantics', () => {
  const baseSubject = {
    id: 'subject-1',
    name: 'Math',
    color: '#111827',
    targetHours: 1,
    progress: 0,
    progressMode: 'manual' as const,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  it('accepts boundary and otherwise valid semantic values', () => {
    expect(() => assertStudyExportSemantics({
      ...emptyTables(),
      subjects: [
        { ...baseSubject, progress: 0, targetHours: 0.5 },
        { ...baseSubject, id: 'subject-2', progress: 100, targetHours: 1 },
      ],
      tasks: [{
        id: 'task-zero',
        title: 'Zero minutes',
        subjectId: '',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      }, {
        id: 'task-above-editor-max',
        title: 'Above editor minutes',
        subjectId: '',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: 721,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      studySessions: [{
        id: 'session-1',
        subjectId: '',
        startedAt: '2026-07-24T10:00:00.000Z',
        endedAt: '2026-07-24T10:00:00.000Z',
        minutes: 1,
        note: '',
      }],
      events: [{
        id: 'event-1',
        title: 'Same start/end',
        subjectId: '',
        startAt: '2026-07-24T10:00:00.000Z',
        endAt: '2026-07-24T10:00:00.000Z',
        location: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      goals: [{
        id: 'goal-1',
        title: 'Over target ok',
        target: 10,
        progress: 25,
        period: 'daily',
        metric: 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
      }, {
        id: 'goal-2',
        title: 'Zero progress',
        target: 1,
        progress: 0,
        period: 'weekly',
        metric: 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
      }, {
        id: 'goal-above-editor-max',
        title: 'Above editor target max',
        target: 10_001,
        progress: 0,
        period: 'monthly',
        metric: 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      flashcards: [{
        id: 'card-1',
        front: 'Q',
        back: 'A',
        subjectId: '',
        status: 'new',
        lastReviewedAt: '',
        intervalDays: 0,
        reviewCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      }, {
        id: 'card-2',
        front: 'Q2',
        back: 'A2',
        subjectId: '',
        status: 'new',
        lastReviewedAt: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    })).not.toThrow()
  })

  it('rejects subjects with progress outside 0–100 or non-positive targetHours', () => {
    expect(() => assertStudyExportSemantics({
      ...emptyTables(),
      subjects: [{ ...baseSubject, progress: -1 }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSemantics({
      ...emptyTables(),
      subjects: [{ ...baseSubject, progress: 101 }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSemantics({
      ...emptyTables(),
      subjects: [{ ...baseSubject, targetHours: 0 }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSemantics({
      ...emptyTables(),
      subjects: [{ ...baseSubject, targetHours: -2 }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
  })

  it('rejects negative task minutes while allowing zero', () => {
    expect(() => assertStudyExportSemantics({
      ...emptyTables(),
      tasks: [{
        id: 'task-neg',
        title: 'Bad',
        subjectId: '',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: -1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
  })

  it('rejects non-positive session minutes and sessions ending before they start', () => {
    expect(() => assertStudyExportSemantics({
      ...emptyTables(),
      studySessions: [{
        id: 'session-zero',
        subjectId: '',
        startedAt: timestamp,
        endedAt: timestamp,
        minutes: 0,
        note: '',
      }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSemantics({
      ...emptyTables(),
      studySessions: [{
        id: 'session-order',
        subjectId: '',
        startedAt: '2026-07-24T12:00:00.000Z',
        endedAt: '2026-07-24T11:00:00.000Z',
        minutes: 5,
        note: '',
      }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
  })

  it('rejects events ending before they start', () => {
    expect(() => assertStudyExportSemantics({
      ...emptyTables(),
      events: [{
        id: 'event-order',
        title: 'Bad',
        subjectId: '',
        startAt: '2026-07-24T12:00:00.000Z',
        endAt: '2026-07-24T11:00:00.000Z',
        location: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
  })

  it('accepts events longer than the Calendar editor duration ceiling and future-ended study sessions', () => {
    expect(() => assertStudyExportSemantics({
      ...emptyTables(),
      events: [{
        id: 'event-long',
        title: 'All-day block',
        subjectId: '',
        startAt: '2026-07-24T08:00:00.000Z',
        endAt: '2026-07-24T18:00:00.000Z',
        location: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      studySessions: [{
        id: 'session-future',
        subjectId: '',
        startedAt: '2099-01-01T10:00:00.000Z',
        endedAt: '2099-01-01T11:00:00.000Z',
        minutes: 60,
        note: '',
      }],
    })).not.toThrow()
  })

  it('rejects non-positive goal targets and negative progress, allowing over-target progress', () => {
    expect(() => assertStudyExportSemantics({
      ...emptyTables(),
      goals: [{
        id: 'goal-target',
        title: 'Bad target',
        target: 0,
        progress: 0,
        period: 'daily',
        metric: 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSemantics({
      ...emptyTables(),
      goals: [{
        id: 'goal-progress',
        title: 'Bad progress',
        target: 10,
        progress: -1,
        period: 'daily',
        metric: 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSemantics({
      ...emptyTables(),
      goals: [{
        id: 'goal-over',
        title: 'Over target',
        target: 10,
        progress: 50,
        period: 'daily',
        metric: 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    })).not.toThrow()
  })

  it('keeps Goal editor 1–10000 and settings dailyGoalMinutes 30–720 ranges distinct', () => {
    expect(() => assertStudyExportSemantics({
      ...emptyTables(),
      goals: [{
        id: 'goal-above-editor',
        title: 'Import above editor max',
        target: 10_001,
        progress: 0,
        period: 'daily',
        metric: 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    })).not.toThrow()

    expect(() => assertStudyExportSettingsValues({
      ...emptyTables(),
      settings: [{ key: 'dailyGoalMinutes', value: 29 }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSettingsValues({
      ...emptyTables(),
      settings: [{ key: 'dailyGoalMinutes', value: 721 }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSettingsValues({
      ...emptyTables(),
      settings: [{ key: 'dailyGoalMinutes', value: 30 }],
    })).not.toThrow()
  })

  it('rejects negative flashcard intervalDays or reviewCount when present', () => {
    expect(() => assertStudyExportSemantics({
      ...emptyTables(),
      flashcards: [{
        id: 'card-interval',
        front: 'Q',
        back: 'A',
        subjectId: '',
        status: 'new',
        lastReviewedAt: '',
        intervalDays: -1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSemantics({
      ...emptyTables(),
      flashcards: [{
        id: 'card-reviews',
        front: 'Q',
        back: 'A',
        subjectId: '',
        status: 'new',
        lastReviewedAt: '',
        reviewCount: -1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
  })
})

describe('assertStudyExportSettingsValues', () => {
  const validFocus = {
    id: 'focus-1',
    subjectId: '',
    startedAt: timestamp,
    plannedMinutes: 25,
    status: 'running' as const,
    pausedAt: null,
    accumulatedPausedMs: 0,
  }

  it('accepts known-setting boundaries and unknown keys unchanged', () => {
    expect(() => assertStudyExportSettingsValues({
      settings: [
        { key: 'dailyGoalMinutes', value: 30 },
        { key: 'quickNotes', value: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] },
        { key: 'legacy-localstorage-migrated-v1', value: true },
        { key: ACTIVE_FOCUS_SESSION_KEY, value: validFocus },
        { key: 'futurePluginSetting', value: { nested: [1, false] } },
      ],
    })).not.toThrow()

    expect(() => assertStudyExportSettingsValues({
      settings: [
        { key: 'dailyGoalMinutes', value: 720 },
        { key: 'quickNotes', value: [] },
      ],
    })).not.toThrow()
  })

  it('rejects invalid dailyGoalMinutes values', () => {
    expect(() => assertStudyExportSettingsValues({
      settings: [{ key: 'dailyGoalMinutes', value: 29 }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSettingsValues({
      settings: [{ key: 'dailyGoalMinutes', value: 721 }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSettingsValues({
      settings: [{ key: 'dailyGoalMinutes', value: '240' }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSettingsValues({
      settings: [{ key: 'dailyGoalMinutes', value: Number.NaN }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSettingsValues({
      settings: [{ key: 'dailyGoalMinutes', value: Number.POSITIVE_INFINITY }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
  })

  it('rejects invalid quickNotes shapes and counts above eight', () => {
    expect(() => assertStudyExportSettingsValues({
      settings: [{ key: 'quickNotes', value: 'note' }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSettingsValues({
      settings: [{ key: 'quickNotes', value: [1] }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSettingsValues({
      settings: [{ key: 'quickNotes', value: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
  })

  it('rejects legacy-localstorage-migrated-v1 unless exactly true', () => {
    expect(() => assertStudyExportSettingsValues({
      settings: [{ key: 'legacy-localstorage-migrated-v1', value: false }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSettingsValues({
      settings: [{ key: 'legacy-localstorage-migrated-v1', value: 'true' }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSettingsValues({
      settings: [{ key: 'legacy-localstorage-migrated-v1', value: 1 }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
  })

  it('rejects activeFocusSession values that fail isActiveFocusSession', () => {
    expect(() => assertStudyExportSettingsValues({
      settings: [{ key: ACTIVE_FOCUS_SESSION_KEY, value: { id: '', status: 'running' } }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportSettingsValues({
      settings: [{ key: ACTIVE_FOCUS_SESSION_KEY, value: 'corrupt' }],
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
  })

  it('accepts a valid activeFocusSession with General empty subjectId', () => {
    expect(() => assertStudyExportSettingsValues({
      settings: [{ key: ACTIVE_FOCUS_SESSION_KEY, value: { ...validFocus, subjectId: '' } }],
    })).not.toThrow()
  })
})

describe('assertStudyExportRecordCountTotals', () => {
  const zeroCounts = {
    subjects: 0,
    tasks: 0,
    notes: 0,
    events: 0,
    flashcards: 0,
    studySessions: 0,
    goals: 0,
    settings: 0,
  }

  it('accepts exact production per-table and total boundaries without allocating rows', () => {
    expect(() => assertStudyExportRecordCountTotals({
      ...zeroCounts,
      subjects: STUDY_EXPORT_RECORD_LIMITS.subjects,
    })).not.toThrow()
    expect(() => assertStudyExportRecordCountTotals({
      ...zeroCounts,
      tasks: STUDY_EXPORT_RECORD_LIMITS.tasks,
    })).not.toThrow()
    expect(() => assertStudyExportRecordCountTotals({
      ...zeroCounts,
      notes: STUDY_EXPORT_RECORD_LIMITS.notes,
    })).not.toThrow()
    expect(() => assertStudyExportRecordCountTotals({
      ...zeroCounts,
      events: STUDY_EXPORT_RECORD_LIMITS.events,
    })).not.toThrow()
    expect(() => assertStudyExportRecordCountTotals({
      ...zeroCounts,
      flashcards: STUDY_EXPORT_RECORD_LIMITS.flashcards,
    })).not.toThrow()
    expect(() => assertStudyExportRecordCountTotals({
      ...zeroCounts,
      studySessions: STUDY_EXPORT_RECORD_LIMITS.studySessions,
    })).not.toThrow()
    expect(() => assertStudyExportRecordCountTotals({
      ...zeroCounts,
      goals: STUDY_EXPORT_RECORD_LIMITS.goals,
    })).not.toThrow()
    expect(() => assertStudyExportRecordCountTotals({
      ...zeroCounts,
      settings: STUDY_EXPORT_RECORD_LIMITS.settings,
    })).not.toThrow()
    expect(() => assertStudyExportRecordCountTotals({
      subjects: 500,
      tasks: 5_000,
      notes: 5_000,
      events: 5_000,
      flashcards: 4_500,
      studySessions: 4_500,
      goals: 500,
      settings: 0,
    })).not.toThrow()
  })

  it('rejects production over-limit per-table counts and total overflow with individually valid tables', () => {
    expect(() => assertStudyExportRecordCountTotals({
      ...zeroCounts,
      subjects: STUDY_EXPORT_RECORD_LIMITS.subjects + 1,
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
    expect(() => assertStudyExportRecordCountTotals({
      ...zeroCounts,
      tasks: STUDY_EXPORT_RECORD_LIMITS.tasks + 1,
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
    expect(() => assertStudyExportRecordCountTotals({
      ...zeroCounts,
      notes: STUDY_EXPORT_RECORD_LIMITS.notes + 1,
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
    expect(() => assertStudyExportRecordCountTotals({
      ...zeroCounts,
      events: STUDY_EXPORT_RECORD_LIMITS.events + 1,
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
    expect(() => assertStudyExportRecordCountTotals({
      ...zeroCounts,
      flashcards: STUDY_EXPORT_RECORD_LIMITS.flashcards + 1,
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
    expect(() => assertStudyExportRecordCountTotals({
      ...zeroCounts,
      studySessions: STUDY_EXPORT_RECORD_LIMITS.studySessions + 1,
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
    expect(() => assertStudyExportRecordCountTotals({
      ...zeroCounts,
      goals: STUDY_EXPORT_RECORD_LIMITS.goals + 1,
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
    expect(() => assertStudyExportRecordCountTotals({
      ...zeroCounts,
      settings: STUDY_EXPORT_RECORD_LIMITS.settings + 1,
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportRecordCountTotals({
      subjects: 500,
      tasks: 5_000,
      notes: 5_000,
      events: 5_000,
      flashcards: 4_500,
      studySessions: 4_501,
      goals: 500,
      settings: 0,
    })).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
  })
})

describe('assertStudyExportRecordCounts', () => {
  const tinyLimits: StudyExportRecordLimits = {
    total: 5,
    subjects: 2,
    tasks: 2,
    notes: 2,
    events: 2,
    flashcards: 2,
    studySessions: 2,
    goals: 2,
    settings: 2,
  }

  const subject = (id: string) => ({
    id,
    name: id,
    color: '#111827',
    targetHours: 1,
    progress: 0,
    progressMode: 'manual' as const,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  it('accepts snapshot boundaries under injectable limits and rejects over-limit arrays', () => {
    expect(() => assertStudyExportRecordCounts({
      ...emptyTables(),
      subjects: [subject('a'), subject('b')],
    }, tinyLimits)).not.toThrow()

    expect(() => assertStudyExportRecordCounts({
      ...emptyTables(),
      subjects: [subject('a'), subject('b'), subject('c')],
    }, tinyLimits)).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)

    expect(() => assertStudyExportRecordCounts({
      ...emptyTables(),
      subjects: [subject('a')],
      tasks: [{
        id: 't1',
        title: 'T',
        subjectId: '',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      notes: [{
        id: 'n1',
        title: 'N',
        body: '',
        subjectId: '',
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      events: [{
        id: 'e1',
        title: 'E',
        subjectId: '',
        startAt: timestamp,
        endAt: timestamp,
        location: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      flashcards: [{
        id: 'c1',
        front: 'Q',
        back: 'A',
        subjectId: '',
        status: 'new',
        lastReviewedAt: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    }, tinyLimits)).not.toThrow()

    expect(() => assertStudyExportRecordCounts({
      ...emptyTables(),
      subjects: [subject('a')],
      tasks: [{
        id: 't1',
        title: 'T',
        subjectId: '',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      notes: [{
        id: 'n1',
        title: 'N',
        body: '',
        subjectId: '',
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      events: [{
        id: 'e1',
        title: 'E',
        subjectId: '',
        startAt: timestamp,
        endAt: timestamp,
        location: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      flashcards: [{
        id: 'c1',
        front: 'Q',
        back: 'A',
        subjectId: '',
        status: 'new',
        lastReviewedAt: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      studySessions: [{
        id: 's1',
        subjectId: '',
        startedAt: timestamp,
        endedAt: timestamp,
        minutes: 1,
        note: '',
      }],
    }, tinyLimits)).toThrow(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
  })
})
