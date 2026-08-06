import { describe, expect, it } from 'vitest'
import { ACTIVE_FOCUS_SESSION_KEY } from './activeFocusSession'
import {
  assertStudyExportSubjectReferences,
  assertUniqueStudyExportIdentifiers,
  STUDY_EXPORT_IMPORT_VALIDATION_ERROR,
} from './studyExportValidation'
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
