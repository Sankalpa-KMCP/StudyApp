import { describe, expect, it } from 'vitest'
import {
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
