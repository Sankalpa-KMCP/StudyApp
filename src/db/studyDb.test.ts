import Dexie, { type Table } from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllStudyData, createStudyExportPayload, exportStudyData, getStudyData, importStudyData, migrateLegacyLocalStorage, nowIso, parseAndNormalizeStudyExport, readStudyDataSnapshot, studyDb, StudyDatabase } from './studyDb'
import { assertStudyExportImportFileSize, assertStudyExportImportTextLength, MAX_STUDY_EXPORT_IMPORT_BYTES, MAX_STUDY_EXPORT_IMPORT_CHARS } from './studyExportLimits'
import type { ActiveFocusSession, StudyGoal } from './types'

const STUDY_DB_NAME = 'study-dashboard-db'

const V1_STORES = {
  tasks: '&id, status, priority, dueDate, subjectId, createdAt, updatedAt',
  subjects: '&id, name, color, createdAt, updatedAt',
  notes: '&id, subjectId, createdAt, updatedAt, *tags',
  events: '&id, subjectId, startAt, endAt, createdAt, updatedAt',
  flashcards: '&id, subjectId, status, lastReviewedAt, createdAt, updatedAt',
  studySessions: '&id, subjectId, startedAt, endedAt',
  goals: '&id, period, createdAt, updatedAt',
  settings: '&key',
} as const

/** Opens only Dexie version 1 so upgrade to the app schema can be exercised. */
class StudyDatabaseV1Only extends Dexie {
  goals!: Table<Record<string, unknown>, string>

  constructor() {
    super(STUDY_DB_NAME)
    this.version(1).stores(V1_STORES)
  }
}

async function seedVersion1Goals(goals: Array<Record<string, unknown>>) {
  if (studyDb.isOpen()) studyDb.close()
  await studyDb.delete()

  const v1 = new StudyDatabaseV1Only()
  await v1.open()
  expect(v1.verno).toBe(1)
  await v1.table('goals').bulkAdd(goals)
  v1.close()
}

async function seedVersion1SubjectsAndSessions(
  subjects: Array<Record<string, unknown>>,
  sessions: Array<Record<string, unknown>>,
) {
  if (studyDb.isOpen()) studyDb.close()
  await studyDb.delete()

  const v1 = new StudyDatabaseV1Only()
  await v1.open()
  expect(v1.verno).toBe(1)
  await v1.table('subjects').bulkAdd(subjects)
  await v1.table('studySessions').bulkAdd(sessions)
  v1.close()
}

describe('studyDb', () => {
  beforeEach(async () => {
    localStorage.clear()
    if (studyDb.isOpen()) {
      studyDb.close()
    }
    await studyDb.delete()
    await studyDb.open()
  })

  it('starts empty and clears all saved records', async () => {
    expect(await getStudyData()).toMatchObject({
      tasks: [],
      subjects: [],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
    })

    const timestamp = nowIso()
    await studyDb.tasks.add({
      id: 'task-test',
      title: 'Saved task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await clearAllStudyData()

    expect((await getStudyData()).tasks).toHaveLength(0)
  })

  it('exports and imports database snapshots', async () => {
    const timestamp = nowIso()
    await studyDb.subjects.add({
      id: 'subject-math',
      name: 'Math',
      color: '#111827',
      targetHours: 5,
      progress: 10,
      progressMode: 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await studyDb.flashcards.add({
      id: 'card-rule',
      front: 'Rule',
      back: 'Answer',
      subjectId: 'subject-math',
      status: 'new',
      lastReviewedAt: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    await Promise.all([
      studyDb.tasks.add({
        id: 'task-rule',
        title: 'Review rule',
        subjectId: 'subject-math',
        dueDate: '',
        priority: 'high',
        status: 'open',
        minutes: 30,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
      studyDb.notes.add({
        id: 'note-rule',
        title: 'Rule notes',
        body: 'Worked example',
        subjectId: 'subject-math',
        tags: ['revision'],
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
      studyDb.events.add({
        id: 'event-rule',
        title: 'Review block',
        subjectId: 'subject-math',
        startAt: timestamp,
        endAt: timestamp,
        location: 'Library',
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
      studyDb.studySessions.add({
        id: 'session-rule',
        subjectId: 'subject-math',
        startedAt: timestamp,
        endedAt: timestamp,
        minutes: 25,
        note: 'Practice',
      }),
      studyDb.goals.add({
        id: 'goal-rule',
        title: 'Study goal',
        target: 120,
        progress: 25,
        period: 'weekly',
        metric: 'study_time',
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ])

    const snapshot = await exportStudyData()
    await clearAllStudyData()
    await importStudyData(snapshot)

    const restored = await getStudyData()
    expect(restored.subjects[0]?.name).toBe('Math')
    expect(restored.flashcards[0]?.front).toBe('Rule')
    expect(restored.tasks[0]?.title).toBe('Review rule')
    expect(restored.notes[0]?.title).toBe('Rule notes')
    expect(restored.events[0]?.title).toBe('Review block')
    expect(restored.studySessions[0]?.note).toBe('Practice')
    expect(restored.goals[0]?.title).toBe('Study goal')
    expect(snapshot.version).toBe(3)
    expect(restored.goals[0]?.metric).toBe('study_time')
    expect(restored.subjects[0]?.progressMode).toBe('manual')
  })

  it('AC-7: exports study data inside one Dexie readonly transaction covering all study tables', async () => {
    let capturedMode: string | null = null
    let capturedTables: string[] = []

    const originalTransaction = studyDb.transaction.bind(studyDb)
    const transactionSpy = vi.spyOn(studyDb, 'transaction').mockImplementation((mode: unknown, ...args: unknown[]) => {
      capturedMode = mode as string
      const tables = args.slice(0, -1).flat() as Array<{ name: string }>
      capturedTables = tables.map((t) => t.name)
      return (originalTransaction as (...a: unknown[]) => unknown)(mode, ...args) as Promise<unknown>
    })

    const snapshot = await exportStudyData()

    expect(transactionSpy).toHaveBeenCalledTimes(1)
    expect(capturedMode).toBe('r')
    expect(capturedTables).toEqual([
      'tasks',
      'subjects',
      'notes',
      'events',
      'flashcards',
      'studySessions',
      'goals',
      'settings',
    ])
    expect(snapshot.version).toBe(3)
    transactionSpy.mockRestore()
  })

  it('reads study data snapshot inside one Dexie readonly transaction without metadata', async () => {
    let capturedMode: string | null = null
    let capturedTables: string[] = []

    const originalTransaction = studyDb.transaction.bind(studyDb)
    const transactionSpy = vi.spyOn(studyDb, 'transaction').mockImplementation((mode: unknown, ...args: unknown[]) => {
      capturedMode = mode as string
      const tables = args.slice(0, -1).flat() as Array<{ name: string }>
      capturedTables = tables.map((t) => t.name)
      return (originalTransaction as (...a: unknown[]) => unknown)(mode, ...args) as Promise<unknown>
    })

    const rawSnapshot = await readStudyDataSnapshot()

    expect(transactionSpy).toHaveBeenCalledTimes(1)
    expect(capturedMode).toBe('r')
    expect(capturedTables).toEqual([
      'tasks',
      'subjects',
      'notes',
      'events',
      'flashcards',
      'studySessions',
      'goals',
      'settings',
    ])
    expect((rawSnapshot as Record<string, unknown>).version).toBeUndefined()
    expect((rawSnapshot as Record<string, unknown>).exportedAt).toBeUndefined()
    expect(Array.isArray(rawSnapshot.tasks)).toBe(true)

    transactionSpy.mockRestore()
  })

  it('assembles version-3 export payload with supplied timestamp post-transaction', () => {
    const fakeSnapshot = {
      tasks: [],
      subjects: [],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
      settings: [],
    }
    const customTimestamp = '2026-07-28T12:00:00.000Z'
    const payload = createStudyExportPayload(fakeSnapshot, customTimestamp)

    expect(payload.version).toBe(3)
    expect(payload.exportedAt).toBe(customTimestamp)
    expect(payload.tasks).toEqual([])
    expect(payload.subjects).toEqual([])
  })

  it('exports version 3 with explicit subject progress modes and round-trips them', async () => {
    const timestamp = nowIso()
    await studyDb.goals.bulkAdd([
      {
        id: 'goal-manual-export',
        title: 'Daily focus',
        target: 90,
        progress: 10,
        period: 'daily',
        metric: 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'goal-study-export',
        title: 'Read chapters',
        target: 5,
        progress: 1,
        period: 'weekly',
        metric: 'study_time',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ])
    await studyDb.subjects.bulkAdd([
      {
        id: 'subject-manual-export',
        name: 'Manual Subject',
        color: '#111827',
        targetHours: 4,
        progress: 25,
        progressMode: 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'subject-study-export',
        name: 'Study Subject',
        color: '#2563eb',
        targetHours: 2,
        progress: 10,
        progressMode: 'study_time',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ])

    const snapshot = await exportStudyData()
    expect(snapshot.version).toBe(3)
    expect(snapshot.goals.every((goal) => goal.metric === 'manual' || goal.metric === 'study_time')).toBe(true)
    expect(snapshot.subjects.every((subject) => subject.progressMode === 'manual' || subject.progressMode === 'study_time')).toBe(true)

    await clearAllStudyData()
    await importStudyData(snapshot)

    const restoredGoals = await studyDb.goals.toArray()
    const goalsById = new Map(restoredGoals.map((goal) => [goal.id, goal]))
    expect(goalsById.get('goal-manual-export')?.metric).toBe('manual')
    expect(goalsById.get('goal-study-export')?.metric).toBe('study_time')
    expect(goalsById.get('goal-manual-export')?.title).toBe('Daily focus')

    const restoredSubjects = await studyDb.subjects.toArray()
    const subjectsById = new Map(restoredSubjects.map((subject) => [subject.id, subject]))
    expect(subjectsById.get('subject-manual-export')?.progressMode).toBe('manual')
    expect(subjectsById.get('subject-study-export')?.progressMode).toBe('study_time')
    expect(subjectsById.get('subject-study-export')?.progress).toBe(10)
  })

  it('imports version-1 backups by normalizing legacy goal metrics', async () => {
    const timestamp = '2026-07-21T08:00:00.000Z'
    const version1Backup = {
      version: 1 as const,
      exportedAt: timestamp,
      tasks: [],
      subjects: [],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [
        {
          id: 'v1-daily-focus',
          title: 'Daily Focus',
          target: 120,
          progress: 15,
          period: 'daily' as const,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: 'v1-weekly-study',
          title: 'Weekly study hours',
          target: 10,
          progress: 2,
          period: 'weekly' as const,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: 'v1-weekly-focus',
          title: 'Focus week',
          target: 8,
          progress: 1,
          period: 'weekly' as const,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: 'v1-daily-study-only',
          title: 'Study 2 hours daily',
          target: 120,
          progress: 40,
          period: 'daily' as const,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: 'v1-weekly-manual',
          title: 'Read chapters',
          target: 5,
          progress: 1,
          period: 'weekly' as const,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: 'v1-monthly-focus',
          title: 'Monthly focus',
          target: 20,
          progress: 3,
          period: 'monthly' as const,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      settings: [{ key: 'dailyGoalMinutes', value: 200 }],
    }

    await importStudyData(version1Backup)
    const byId = new Map((await studyDb.goals.toArray()).map((goal) => [goal.id, goal]))

    expect(byId.get('v1-daily-focus')).toEqual({
      id: 'v1-daily-focus',
      title: 'Daily Focus',
      target: 120,
      progress: 15,
      period: 'daily',
      metric: 'study_time',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    expect(byId.get('v1-weekly-study')?.metric).toBe('study_time')
    expect(byId.get('v1-weekly-focus')?.metric).toBe('study_time')
    expect(byId.get('v1-daily-study-only')?.metric).toBe('manual')
    expect(byId.get('v1-weekly-manual')?.metric).toBe('manual')
    expect(byId.get('v1-monthly-focus')?.metric).toBe('manual')
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(200)
  })

  it('imports version-2 metrics exactly and rejects invalid metrics without clearing data', async () => {
    const timestamp = nowIso()
    await studyDb.subjects.add({
      id: 'subject-keep',
      name: 'Keep me',
      color: '#111827',
      targetHours: 5,
      progress: 10,
      progressMode: 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await studyDb.settings.put({
      key: 'activeFocusSession',
      value: {
        id: 'focus-keep',
        subjectId: '',
        startedAt: timestamp,
        plannedMinutes: 0,
        status: 'running',
        pausedAt: null,
        accumulatedPausedMs: 0,
      },
    })

    const validV2 = {
      version: 2 as const,
      exportedAt: timestamp,
      tasks: [],
      subjects: [],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [
        {
          id: 'v2-manual',
          title: 'Daily focus',
          target: 60,
          progress: 5,
          period: 'daily' as const,
          metric: 'manual' as const,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: 'v2-study',
          title: 'Quiet reading',
          target: 4,
          progress: 0,
          period: 'weekly' as const,
          metric: 'study_time' as const,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      settings: [
        {
          key: 'activeFocusSession',
          value: {
            id: 'focus-imported',
            subjectId: '',
            startedAt: timestamp,
            plannedMinutes: 25,
            status: 'paused',
            pausedAt: timestamp,
            accumulatedPausedMs: 0,
          },
        },
      ],
    }

    await importStudyData(validV2)
    expect((await studyDb.goals.get('v2-manual'))?.metric).toBe('manual')
    expect((await studyDb.goals.get('v2-study'))?.metric).toBe('study_time')
    expect((await studyDb.goals.get('v2-manual'))?.title).toBe('Daily focus')
    expect((await studyDb.settings.get('activeFocusSession'))?.value).toMatchObject({ id: 'focus-imported', status: 'paused' })

    await studyDb.subjects.add({
      id: 'subject-seeded',
      name: 'Seeded subject',
      color: '#2563eb',
      targetHours: 3,
      progress: 0,
      progressMode: 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    const missingMetric = {
      ...validV2,
      goals: [{
        id: 'v2-missing-metric',
        title: 'Daily focus',
        target: 60,
        progress: 0,
        period: 'daily',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    }
    await expect(importStudyData(missingMetric)).rejects.toThrow('Import file is not a Study Dashboard export.')
    expect(await studyDb.subjects.get('subject-seeded')).toMatchObject({ name: 'Seeded subject' })

    const unknownMetric = {
      ...validV2,
      goals: [{
        id: 'v2-unknown-metric',
        title: 'Daily focus',
        target: 60,
        progress: 0,
        period: 'daily',
        metric: 'derived',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    }
    await expect(importStudyData(unknownMetric)).rejects.toThrow('Import file is not a Study Dashboard export.')
    expect(await studyDb.subjects.get('subject-seeded')).toMatchObject({ name: 'Seeded subject' })

    const nonStringMetric = {
      ...validV2,
      goals: [{
        id: 'v2-nonstring-metric',
        title: 'Daily focus',
        target: 60,
        progress: 0,
        period: 'daily',
        metric: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    }
    await expect(importStudyData(nonStringMetric)).rejects.toThrow('Import file is not a Study Dashboard export.')
    expect(await studyDb.subjects.get('subject-seeded')).toMatchObject({ name: 'Seeded subject' })

    await expect(importStudyData({ ...validV2, version: 4 })).rejects.toThrow('Import file schema version (4) is newer than supported version (3).')
    expect(await studyDb.subjects.get('subject-seeded')).toMatchObject({ name: 'Seeded subject' })
    expect((await studyDb.settings.get('activeFocusSession'))?.value).toMatchObject({ id: 'focus-imported' })
  })

  it('normalizes version-1 and version-2 subject modes from imported sessions', async () => {
    const timestamp = '2026-07-21T08:00:00.000Z'
    const subjects = [
      {
        id: 'subject-with-time',
        name: 'Chemistry',
        color: '#0f766e',
        targetHours: 2,
        progress: 40,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'subject-manual-only',
        name: 'History',
        color: '#b45309',
        targetHours: 3,
        progress: 15,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]
    const studySessions = [
      {
        id: 'session-chem',
        subjectId: 'subject-with-time',
        startedAt: timestamp,
        endedAt: timestamp,
        minutes: 30,
        note: 'Lab',
      },
    ]

    await importStudyData({
      version: 1 as const,
      exportedAt: timestamp,
      tasks: [],
      subjects,
      notes: [],
      events: [],
      flashcards: [],
      studySessions,
      goals: [],
      settings: [],
    })

    expect(await studyDb.subjects.get('subject-with-time')).toMatchObject({
      progress: 40,
      targetHours: 2,
      progressMode: 'study_time',
    })
    expect(await studyDb.subjects.get('subject-manual-only')).toMatchObject({
      progress: 15,
      progressMode: 'manual',
    })

    await clearAllStudyData()
    await importStudyData({
      version: 2 as const,
      exportedAt: timestamp,
      tasks: [],
      subjects,
      notes: [],
      events: [],
      flashcards: [],
      studySessions,
      goals: [],
      settings: [],
    })

    expect(await studyDb.subjects.get('subject-with-time')).toMatchObject({ progressMode: 'study_time', progress: 40 })
    expect(await studyDb.subjects.get('subject-manual-only')).toMatchObject({ progressMode: 'manual', progress: 15 })
  })

  it('rejects version-3 backups with missing or invalid subject modes without clearing data', async () => {
    const timestamp = nowIso()
    await studyDb.subjects.add({
      id: 'subject-seeded',
      name: 'Seeded subject',
      color: '#2563eb',
      targetHours: 3,
      progress: 0,
      progressMode: 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    const validSubject = {
      id: 'subject-ok',
      name: 'Ok',
      color: '#111827',
      targetHours: 2,
      progress: 10,
      progressMode: 'manual' as const,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const baseV3 = {
      version: 3 as const,
      exportedAt: timestamp,
      tasks: [],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
      settings: [],
    }

    const missingMode = {
      ...baseV3,
      subjects: [{
        id: 'subject-missing-mode',
        name: 'Missing mode',
        color: '#111827',
        targetHours: 2,
        progress: 10,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    }
    await expect(importStudyData(missingMode)).rejects.toThrow('Import file is not a Study Dashboard export.')
    expect(await studyDb.subjects.get('subject-seeded')).toMatchObject({ name: 'Seeded subject' })

    const invalidMode = {
      ...baseV3,
      subjects: [{ ...validSubject, progressMode: 'derived' }],
    }
    await expect(importStudyData(invalidMode)).rejects.toThrow('Import file is not a Study Dashboard export.')
    expect(await studyDb.subjects.get('subject-seeded')).toMatchObject({ name: 'Seeded subject' })

    await importStudyData({ ...baseV3, subjects: [validSubject] })
    expect(await studyDb.subjects.get('subject-ok')).toMatchObject({ progressMode: 'manual', progress: 10 })
  })

  it('rejects malformed records without replacing existing data', async () => {
    const timestamp = nowIso()
    await studyDb.subjects.add({
      id: 'subject-existing',
      name: 'Existing subject',
      color: '#111827',
      targetHours: 5,
      progress: 10,
      progressMode: 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    const malformedSnapshot = {
      version: 1,
      exportedAt: timestamp,
      tasks: [],
      subjects: [{ id: 'subject-invalid', name: 123 }],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
      settings: [],
    }

    await expect(importStudyData(malformedSnapshot)).rejects.toThrow('Import file is not a Study Dashboard export.')
    expect(await studyDb.subjects.toArray()).toMatchObject([{ id: 'subject-existing', name: 'Existing subject' }])
  })

  it('rejects duplicate entity ids and settings keys without clearing existing data', async () => {
    const timestamp = nowIso()
    await studyDb.subjects.add({
      id: 'subject-seeded',
      name: 'Seeded subject',
      color: '#2563eb',
      targetHours: 3,
      progress: 0,
      progressMode: 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await studyDb.tasks.add({
      id: 'task-seeded',
      title: 'Seeded task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await studyDb.settings.put({
      key: 'activeFocusSession',
      value: {
        id: 'focus-seeded',
        subjectId: '',
        startedAt: timestamp,
        plannedMinutes: 25,
        status: 'running',
        pausedAt: null,
        accumulatedPausedMs: 0,
      },
    })
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 180 })

    const emptyTables = {
      tasks: [],
      subjects: [],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
      settings: [],
    }

    const subjectRow = {
      id: 'dup-subject',
      name: 'Dup',
      color: '#111827',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual' as const,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const legacySubjectRow = {
      id: 'dup-subject',
      name: 'Dup',
      color: '#111827',
      targetHours: 2,
      progress: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const duplicateCases = [
      {
        version: 3 as const,
        ...emptyTables,
        subjects: [subjectRow, { ...subjectRow, name: 'Other' }],
      },
      {
        version: 3 as const,
        ...emptyTables,
        tasks: [
          {
            id: 'dup-task',
            title: 'A',
            subjectId: '',
            dueDate: '',
            priority: 'normal' as const,
            status: 'open' as const,
            minutes: 30,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          {
            id: 'dup-task',
            title: 'B',
            subjectId: '',
            dueDate: '',
            priority: 'normal' as const,
            status: 'open' as const,
            minutes: 30,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      },
      {
        version: 3 as const,
        ...emptyTables,
        notes: [
          {
            id: 'dup-note',
            title: 'A',
            body: '',
            subjectId: '',
            tags: [] as string[],
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          {
            id: 'dup-note',
            title: 'B',
            body: '',
            subjectId: '',
            tags: [] as string[],
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      },
      {
        version: 3 as const,
        ...emptyTables,
        events: [
          {
            id: 'dup-event',
            title: 'A',
            subjectId: '',
            startAt: timestamp,
            endAt: timestamp,
            location: '',
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          {
            id: 'dup-event',
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
      {
        version: 3 as const,
        ...emptyTables,
        flashcards: [
          {
            id: 'dup-card',
            front: 'A',
            back: 'A',
            subjectId: '',
            status: 'new' as const,
            lastReviewedAt: '',
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          {
            id: 'dup-card',
            front: 'B',
            back: 'B',
            subjectId: '',
            status: 'new' as const,
            lastReviewedAt: '',
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      },
      {
        version: 3 as const,
        ...emptyTables,
        studySessions: [
          {
            id: 'dup-session',
            subjectId: '',
            startedAt: timestamp,
            endedAt: timestamp,
            minutes: 10,
            note: '',
          },
          {
            id: 'dup-session',
            subjectId: '',
            startedAt: timestamp,
            endedAt: timestamp,
            minutes: 20,
            note: '',
          },
        ],
      },
      {
        version: 3 as const,
        ...emptyTables,
        goals: [
          {
            id: 'dup-goal',
            title: 'A',
            target: 10,
            progress: 0,
            period: 'daily' as const,
            metric: 'manual' as const,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          {
            id: 'dup-goal',
            title: 'B',
            target: 10,
            progress: 0,
            period: 'daily' as const,
            metric: 'manual' as const,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      },
      {
        version: 3 as const,
        ...emptyTables,
        settings: [
          { key: 'dailyGoalMinutes', value: 120 },
          { key: 'dailyGoalMinutes', value: 999 },
        ],
      },
      {
        version: 1 as const,
        ...emptyTables,
        subjects: [legacySubjectRow, { ...legacySubjectRow, name: 'Other' }],
        goals: [],
      },
      {
        version: 2 as const,
        ...emptyTables,
        subjects: [legacySubjectRow, { ...legacySubjectRow, name: 'Other' }],
        goals: [],
      },
    ]

    for (const snapshot of duplicateCases) {
      await expect(importStudyData({ ...snapshot, exportedAt: timestamp }))
        .rejects.toThrow('Import file is not a Study Dashboard export.')
      expect(await studyDb.subjects.get('subject-seeded')).toMatchObject({ name: 'Seeded subject' })
      expect(await studyDb.tasks.get('task-seeded')).toMatchObject({ title: 'Seeded task' })
      expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(180)
      expect((await studyDb.settings.get('activeFocusSession'))?.value).toMatchObject({ id: 'focus-seeded' })
    }
  })

  it('allows the same identifier across different entity tables on import', async () => {
    const timestamp = nowIso()
    const sharedId = 'shared-cross-table-id'

    await importStudyData({
      version: 3 as const,
      exportedAt: timestamp,
      subjects: [{
        id: sharedId,
        name: 'Shared subject',
        color: '#111827',
        targetHours: 2,
        progress: 0,
        progressMode: 'manual' as const,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      tasks: [{
        id: sharedId,
        title: 'Shared task',
        subjectId: sharedId,
        dueDate: '',
        priority: 'normal' as const,
        status: 'open' as const,
        minutes: 30,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      notes: [{
        id: sharedId,
        title: 'Shared note',
        body: '',
        subjectId: sharedId,
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [{
        id: sharedId,
        title: 'Shared goal',
        target: 10,
        progress: 0,
        period: 'daily' as const,
        metric: 'manual' as const,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      settings: [{ key: 'dailyGoalMinutes', value: 200 }],
    })

    expect(await studyDb.subjects.get(sharedId)).toMatchObject({ name: 'Shared subject' })
    expect(await studyDb.tasks.get(sharedId)).toMatchObject({ title: 'Shared task' })
    expect(await studyDb.notes.get(sharedId)).toMatchObject({ title: 'Shared note' })
    expect(await studyDb.goals.get(sharedId)).toMatchObject({ title: 'Shared goal' })
  })

  it('rejects orphan subject references without clearing existing data', async () => {
    const timestamp = nowIso()
    await studyDb.subjects.add({
      id: 'subject-seeded',
      name: 'Seeded subject',
      color: '#2563eb',
      targetHours: 3,
      progress: 0,
      progressMode: 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await studyDb.tasks.add({
      id: 'task-seeded',
      title: 'Seeded task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 180 })
    await studyDb.settings.put({
      key: 'activeFocusSession',
      value: {
        id: 'focus-seeded',
        subjectId: '',
        startedAt: timestamp,
        plannedMinutes: 25,
        status: 'running',
        pausedAt: null,
        accumulatedPausedMs: 0,
      },
    })
    await studyDb.settings.put({ key: 'customFutureKey', value: { keep: true } })

    const presentSubject = {
      id: 'subject-present',
      name: 'Present',
      color: '#111827',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual' as const,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const legacyPresentSubject = {
      id: 'subject-present',
      name: 'Present',
      color: '#111827',
      targetHours: 2,
      progress: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const emptyTables = {
      tasks: [],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
      settings: [] as Array<{ key: string; value: unknown }>,
    }

    const orphanCases = [
      {
        version: 3 as const,
        subjects: [presentSubject],
        ...emptyTables,
        tasks: [{
          id: 'task-orphan',
          title: 'Orphan',
          subjectId: 'missing-subject',
          dueDate: '',
          priority: 'normal' as const,
          status: 'open' as const,
          minutes: 30,
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      },
      {
        version: 3 as const,
        subjects: [presentSubject],
        ...emptyTables,
        notes: [{
          id: 'note-orphan',
          title: 'Orphan',
          body: '',
          subjectId: 'missing-subject',
          tags: [] as string[],
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      },
      {
        version: 3 as const,
        subjects: [presentSubject],
        ...emptyTables,
        events: [{
          id: 'event-orphan',
          title: 'Orphan',
          subjectId: 'missing-subject',
          startAt: timestamp,
          endAt: timestamp,
          location: '',
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      },
      {
        version: 3 as const,
        subjects: [presentSubject],
        ...emptyTables,
        flashcards: [{
          id: 'card-orphan',
          front: 'Q',
          back: 'A',
          subjectId: 'missing-subject',
          status: 'new' as const,
          lastReviewedAt: '',
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      },
      {
        version: 3 as const,
        subjects: [presentSubject],
        ...emptyTables,
        studySessions: [{
          id: 'session-orphan',
          subjectId: 'missing-subject',
          startedAt: timestamp,
          endedAt: timestamp,
          minutes: 10,
          note: '',
        }],
      },
      {
        version: 3 as const,
        subjects: [presentSubject],
        ...emptyTables,
        settings: [{
          key: 'activeFocusSession',
          value: {
            id: 'focus-orphan',
            subjectId: 'missing-subject',
            startedAt: timestamp,
            plannedMinutes: 25,
            status: 'running',
            pausedAt: null,
            accumulatedPausedMs: 0,
          },
        }],
      },
      {
        version: 1 as const,
        subjects: [legacyPresentSubject],
        ...emptyTables,
        tasks: [{
          id: 'task-orphan-v1',
          title: 'Orphan',
          subjectId: 'missing-subject',
          dueDate: '',
          priority: 'normal' as const,
          status: 'open' as const,
          minutes: 30,
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
        goals: [],
      },
      {
        version: 2 as const,
        subjects: [legacyPresentSubject],
        ...emptyTables,
        studySessions: [{
          id: 'session-orphan-v2',
          subjectId: 'missing-subject',
          startedAt: timestamp,
          endedAt: timestamp,
          minutes: 10,
          note: '',
        }],
        goals: [],
      },
    ]

    for (const snapshot of orphanCases) {
      await expect(importStudyData({ ...snapshot, exportedAt: timestamp }))
        .rejects.toThrow('Import file is not a Study Dashboard export.')
      expect(await studyDb.subjects.get('subject-seeded')).toMatchObject({ name: 'Seeded subject' })
      expect(await studyDb.tasks.get('task-seeded')).toMatchObject({ title: 'Seeded task' })
      expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(180)
      expect((await studyDb.settings.get('activeFocusSession'))?.value).toMatchObject({ id: 'focus-seeded' })
      expect((await studyDb.settings.get('customFutureKey'))?.value).toEqual({ keep: true })
    }
  })

  it('imports General empty subjectIds and valid linked subjectIds', async () => {
    const timestamp = nowIso()

    await importStudyData({
      version: 3 as const,
      exportedAt: timestamp,
      subjects: [{
        id: 'subject-chem',
        name: 'Chemistry',
        color: '#0f766e',
        targetHours: 4,
        progress: 0,
        progressMode: 'manual' as const,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      tasks: [{
        id: 'task-linked',
        title: 'Linked task',
        subjectId: 'subject-chem',
        dueDate: '',
        priority: 'normal' as const,
        status: 'open' as const,
        minutes: 30,
        createdAt: timestamp,
        updatedAt: timestamp,
      }, {
        id: 'task-general',
        title: 'General task',
        subjectId: '',
        dueDate: '',
        priority: 'normal' as const,
        status: 'open' as const,
        minutes: 15,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [{
        id: 'session-general',
        subjectId: '',
        startedAt: timestamp,
        endedAt: timestamp,
        minutes: 20,
        note: 'General',
      }],
      goals: [],
      settings: [{
        key: 'activeFocusSession',
        value: {
          id: 'focus-general',
          subjectId: '',
          startedAt: timestamp,
          plannedMinutes: 0,
          status: 'running',
          pausedAt: null,
          accumulatedPausedMs: 0,
        },
      }, {
        key: 'unknownForwardKey',
        value: 'kept',
      }],
    })

    expect(await studyDb.tasks.get('task-linked')).toMatchObject({ subjectId: 'subject-chem' })
    expect(await studyDb.tasks.get('task-general')).toMatchObject({ subjectId: '' })
    expect(await studyDb.studySessions.get('session-general')).toMatchObject({ subjectId: '' })
    expect((await studyDb.settings.get('activeFocusSession'))?.value).toMatchObject({ subjectId: '' })
    expect((await studyDb.settings.get('unknownForwardKey'))?.value).toBe('kept')
  })

  it('rejects semantically invalid records without clearing existing data', async () => {
    const timestamp = nowIso()
    await studyDb.subjects.add({
      id: 'subject-seeded',
      name: 'Seeded subject',
      color: '#2563eb',
      targetHours: 3,
      progress: 0,
      progressMode: 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 180 })
    await studyDb.settings.put({
      key: 'activeFocusSession',
      value: {
        id: 'focus-seeded',
        subjectId: '',
        startedAt: timestamp,
        plannedMinutes: 25,
        status: 'running',
        pausedAt: null,
        accumulatedPausedMs: 0,
      },
    })

    const emptyTables = {
      tasks: [],
      subjects: [],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
      settings: [] as Array<{ key: string; value: unknown }>,
    }

    const validSubject = {
      id: 'subject-ok',
      name: 'Ok',
      color: '#111827',
      targetHours: 2,
      progress: 10,
      progressMode: 'manual' as const,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const legacySubject = {
      id: 'subject-ok',
      name: 'Ok',
      color: '#111827',
      targetHours: 2,
      progress: 10,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const semanticCases = [
      {
        version: 3 as const,
        ...emptyTables,
        subjects: [{ ...validSubject, progress: 101 }],
      },
      {
        version: 3 as const,
        ...emptyTables,
        subjects: [{ ...validSubject, targetHours: 0 }],
      },
      {
        version: 3 as const,
        ...emptyTables,
        subjects: [validSubject],
        tasks: [{
          id: 'task-neg',
          title: 'Neg',
          subjectId: '',
          dueDate: '',
          priority: 'normal' as const,
          status: 'open' as const,
          minutes: -5,
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      },
      {
        version: 3 as const,
        ...emptyTables,
        subjects: [validSubject],
        studySessions: [{
          id: 'session-zero',
          subjectId: '',
          startedAt: timestamp,
          endedAt: timestamp,
          minutes: 0,
          note: '',
        }],
      },
      {
        version: 3 as const,
        ...emptyTables,
        subjects: [validSubject],
        studySessions: [{
          id: 'session-order',
          subjectId: '',
          startedAt: '2026-07-24T12:00:00.000Z',
          endedAt: '2026-07-24T11:00:00.000Z',
          minutes: 5,
          note: '',
        }],
      },
      {
        version: 3 as const,
        ...emptyTables,
        subjects: [validSubject],
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
      },
      {
        version: 3 as const,
        ...emptyTables,
        subjects: [validSubject],
        goals: [{
          id: 'goal-target',
          title: 'Bad',
          target: 0,
          progress: 0,
          period: 'daily' as const,
          metric: 'manual' as const,
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      },
      {
        version: 3 as const,
        ...emptyTables,
        subjects: [validSubject],
        goals: [{
          id: 'goal-progress',
          title: 'Bad',
          target: 10,
          progress: -1,
          period: 'daily' as const,
          metric: 'manual' as const,
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      },
      {
        version: 3 as const,
        ...emptyTables,
        subjects: [validSubject],
        flashcards: [{
          id: 'card-interval',
          front: 'Q',
          back: 'A',
          subjectId: '',
          status: 'new' as const,
          lastReviewedAt: '',
          intervalDays: -1,
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      },
      {
        version: 1 as const,
        ...emptyTables,
        subjects: [{ ...legacySubject, progress: -1 }],
        goals: [],
      },
      {
        version: 2 as const,
        ...emptyTables,
        subjects: [{ ...legacySubject, targetHours: 0 }],
        goals: [],
      },
    ]

    for (const snapshot of semanticCases) {
      await expect(importStudyData({ ...snapshot, exportedAt: timestamp }))
        .rejects.toThrow('Import file is not a Study Dashboard export.')
      expect(await studyDb.subjects.get('subject-seeded')).toMatchObject({ name: 'Seeded subject' })
      expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(180)
      expect((await studyDb.settings.get('activeFocusSession'))?.value).toMatchObject({ id: 'focus-seeded' })
    }
  })

  it('imports semantically valid boundary values', async () => {
    const timestamp = nowIso()

    await importStudyData({
      version: 3 as const,
      exportedAt: timestamp,
      subjects: [{
        id: 'subject-boundary',
        name: 'Boundary',
        color: '#111827',
        targetHours: 1,
        progress: 100,
        progressMode: 'manual' as const,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      tasks: [{
        id: 'task-zero',
        title: 'Zero minutes',
        subjectId: '',
        dueDate: '',
        priority: 'normal' as const,
        status: 'open' as const,
        minutes: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      notes: [],
      events: [{
        id: 'event-equal',
        title: 'Equal ends',
        subjectId: '',
        startAt: timestamp,
        endAt: timestamp,
        location: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      flashcards: [{
        id: 'card-zero',
        front: 'Q',
        back: 'A',
        subjectId: '',
        status: 'new' as const,
        lastReviewedAt: '',
        intervalDays: 0,
        reviewCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      studySessions: [{
        id: 'session-one',
        subjectId: '',
        startedAt: timestamp,
        endedAt: timestamp,
        minutes: 1,
        note: '',
      }],
      goals: [{
        id: 'goal-over',
        title: 'Over',
        target: 10,
        progress: 40,
        period: 'daily' as const,
        metric: 'manual' as const,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      settings: [],
    })

    expect(await studyDb.subjects.get('subject-boundary')).toMatchObject({ progress: 100 })
    expect(await studyDb.tasks.get('task-zero')).toMatchObject({ minutes: 0 })
    expect(await studyDb.goals.get('goal-over')).toMatchObject({ progress: 40 })
  })

  it('rejects invalid known settings without clearing existing data', async () => {
    const timestamp = nowIso()
    await studyDb.subjects.add({
      id: 'subject-seeded',
      name: 'Seeded subject',
      color: '#2563eb',
      targetHours: 3,
      progress: 0,
      progressMode: 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 180 })
    await studyDb.settings.put({
      key: 'activeFocusSession',
      value: {
        id: 'focus-seeded',
        subjectId: '',
        startedAt: timestamp,
        plannedMinutes: 25,
        status: 'running',
        pausedAt: null,
        accumulatedPausedMs: 0,
      },
    })
    await studyDb.settings.put({ key: 'customFutureKey', value: { keep: true } })

    const emptyTables = {
      tasks: [],
      subjects: [],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
    }

    const settingsCases = [
      {
        version: 3 as const,
        ...emptyTables,
        settings: [{ key: 'dailyGoalMinutes', value: 29 }],
      },
      {
        version: 3 as const,
        ...emptyTables,
        settings: [{ key: 'dailyGoalMinutes', value: 721 }],
      },
      {
        version: 3 as const,
        ...emptyTables,
        settings: [{ key: 'quickNotes', value: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] }],
      },
      {
        version: 3 as const,
        ...emptyTables,
        settings: [{ key: 'quickNotes', value: [1] }],
      },
      {
        version: 3 as const,
        ...emptyTables,
        settings: [{ key: 'legacy-localstorage-migrated-v1', value: false }],
      },
      {
        version: 3 as const,
        ...emptyTables,
        settings: [{ key: 'activeFocusSession', value: { id: '', status: 'running' } }],
      },
      {
        version: 1 as const,
        ...emptyTables,
        settings: [{ key: 'dailyGoalMinutes', value: '240' }],
      },
      {
        version: 2 as const,
        ...emptyTables,
        settings: [{ key: 'quickNotes', value: 'not-an-array' }],
        goals: [],
      },
    ]

    for (const snapshot of settingsCases) {
      await expect(importStudyData({ ...snapshot, exportedAt: timestamp }))
        .rejects.toThrow('Import file is not a Study Dashboard export.')
      expect(await studyDb.subjects.get('subject-seeded')).toMatchObject({ name: 'Seeded subject' })
      expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(180)
      expect((await studyDb.settings.get('activeFocusSession'))?.value).toMatchObject({ id: 'focus-seeded' })
      expect((await studyDb.settings.get('customFutureKey'))?.value).toEqual({ keep: true })
    }
  })

  it('imports valid known settings boundaries and preserves unknown keys', async () => {
    const timestamp = nowIso()

    await importStudyData({
      version: 3 as const,
      exportedAt: timestamp,
      tasks: [],
      subjects: [],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
      settings: [
        { key: 'dailyGoalMinutes', value: 30 },
        { key: 'quickNotes', value: ['one', 'two'] },
        { key: 'legacy-localstorage-migrated-v1', value: true },
        {
          key: 'activeFocusSession',
          value: {
            id: 'focus-imported',
            subjectId: '',
            startedAt: timestamp,
            plannedMinutes: 0,
            status: 'running',
            pausedAt: null,
            accumulatedPausedMs: 0,
          },
        },
        { key: 'plugin.future.setting', value: { ok: true, n: 2 } },
      ],
    })

    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(30)
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual(['one', 'two'])
    expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
    expect((await studyDb.settings.get('activeFocusSession'))?.value).toMatchObject({ id: 'focus-imported', subjectId: '' })
    expect((await studyDb.settings.get('plugin.future.setting'))?.value).toEqual({ ok: true, n: 2 })

    await importStudyData({
      version: 2 as const,
      exportedAt: timestamp,
      tasks: [],
      subjects: [],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
      settings: [{ key: 'dailyGoalMinutes', value: 720 }],
    })
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(720)
  })

  it('rejects over-limit record counts without clearing existing data', async () => {
    const timestamp = nowIso()
    await studyDb.subjects.add({
      id: 'subject-seeded',
      name: 'Seeded subject',
      color: '#2563eb',
      targetHours: 3,
      progress: 0,
      progressMode: 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 180 })
    await studyDb.settings.put({
      key: 'activeFocusSession',
      value: {
        id: 'focus-seeded',
        subjectId: '',
        startedAt: timestamp,
        plannedMinutes: 25,
        status: 'running',
        pausedAt: null,
        accumulatedPausedMs: 0,
      },
    })

    const subjectsOverLimit = Array.from({ length: 501 }, (_, index) => ({
      id: `subject-over-${index}`,
      name: `Subject ${index}`,
      color: '#111827',
      targetHours: 1,
      progress: 0,
      progressMode: 'manual' as const,
      createdAt: timestamp,
      updatedAt: timestamp,
    }))

    await expect(importStudyData({
      version: 3 as const,
      exportedAt: timestamp,
      tasks: [],
      subjects: subjectsOverLimit,
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
      settings: [],
    })).rejects.toThrow('Import file is not a Study Dashboard export.')

    expect(await studyDb.subjects.get('subject-seeded')).toMatchObject({ name: 'Seeded subject' })
    expect(await studyDb.subjects.count()).toBe(1)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(180)
    expect((await studyDb.settings.get('activeFocusSession'))?.value).toMatchObject({ id: 'focus-seeded' })

    const settingsOverLimit = Array.from({ length: 65 }, (_, index) => ({
      key: `setting-${index}`,
      value: index,
    }))

    await expect(importStudyData({
      version: 3 as const,
      exportedAt: timestamp,
      tasks: [],
      subjects: [],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
      settings: settingsOverLimit,
    })).rejects.toThrow('Import file is not a Study Dashboard export.')
    expect(await studyDb.subjects.get('subject-seeded')).toMatchObject({ name: 'Seeded subject' })

    const legacySubjectsOverLimit = subjectsOverLimit.map(
      ({ id, name, color, targetHours, progress, createdAt, updatedAt }) => ({
        id,
        name,
        color,
        targetHours,
        progress,
        createdAt,
        updatedAt,
      }),
    )
    await expect(importStudyData({
      version: 1 as const,
      exportedAt: timestamp,
      tasks: [],
      subjects: legacySubjectsOverLimit,
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
      settings: [],
    })).rejects.toThrow('Import file is not a Study Dashboard export.')
    expect(await studyDb.subjects.get('subject-seeded')).toMatchObject({ name: 'Seeded subject' })
    expect((await studyDb.settings.get('activeFocusSession'))?.value).toMatchObject({ id: 'focus-seeded' })
  })

  it('imports an exact subject-count boundary under the production limit', async () => {
    const timestamp = nowIso()
    const subjects = Array.from({ length: 500 }, (_, index) => ({
      id: `subject-boundary-${index}`,
      name: `Subject ${index}`,
      color: '#111827',
      targetHours: 1,
      progress: 0,
      progressMode: 'manual' as const,
      createdAt: timestamp,
      updatedAt: timestamp,
    }))

    await importStudyData({
      version: 3 as const,
      exportedAt: timestamp,
      tasks: [],
      subjects,
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
      settings: [{ key: 'dailyGoalMinutes', value: 240 }],
    })

    expect(await studyDb.subjects.count()).toBe(500)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(240)
  })

  it('ignores the old bundled sample data during legacy migration', async () => {
    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [{ id: 'task-1', title: 'Review Calculus notes', subject: 'Calculus', done: true, minutes: 45 }],
        subjects: [{ id: 'subject-1', name: 'Calculus', topicsLeft: 4, progress: 60 }],
      }),
    )

    await migrateLegacyLocalStorage()
    expect((await getStudyData()).tasks).toHaveLength(0)
  })

  async function readCompleteStudyDbSnapshot() {
    return {
      tasks: await studyDb.tasks.toArray(),
      subjects: await studyDb.subjects.toArray(),
      notes: await studyDb.notes.toArray(),
      events: await studyDb.events.toArray(),
      flashcards: await studyDb.flashcards.toArray(),
      studySessions: await studyDb.studySessions.toArray(),
      goals: await studyDb.goals.toArray(),
      settings: await studyDb.settings.toArray(),
    }
  }

  it('migrates customized legacy localStorage data once', async () => {
    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [{ id: 'legacy-task', title: 'Custom revision', subject: 'History', done: false, minutes: 25 }],
        notes: [{ id: 'legacy-note', title: 'Treaty summary', tag: 'History', body: 'Key dates.' }],
        quickNotes: ['Read primary source'],
        dailyGoalMinutes: 180,
      }),
    )

    await migrateLegacyLocalStorage()
    const data = await getStudyData()

    expect(data.subjects[0]?.name).toBe('History')
    expect(data.tasks[0]?.title).toBe('Custom revision')
    expect(data.notes[0]?.title).toBe('Treaty summary')
    expect(data.settings.find((setting) => setting.key === 'dailyGoalMinutes')?.value).toBe(180)
  })

  it('defaults legacy event start times to 09:00 when time is missing', async () => {
    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        events: [{ id: 'legacy-event', title: 'Office hours', detail: 'Room 12' }],
      }),
    )

    await migrateLegacyLocalStorage()
    const events = await studyDb.events.toArray()

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      id: 'legacy-event',
      title: 'Office hours',
      location: 'Room 12',
    })
    expect(events[0]?.startAt).toMatch(/T09:00:00\.000$/)
    expect(new Date(events[0]!.endAt).getTime() - new Date(events[0]!.startAt).getTime()).toBe(60 * 60_000)
    expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
  })

  it('converts a valid legacy event wall-clock time into an ISO start time', async () => {
    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        events: [{ id: 'legacy-timed', title: 'Lab session', time: '14:30' }],
      }),
    )

    await migrateLegacyLocalStorage()
    const event = await studyDb.events.get('legacy-timed')

    expect(event?.title).toBe('Lab session')
    expect(event?.startAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(event?.startAt.endsWith('T09:00:00.000')).toBe(false)
    expect(Number.isNaN(new Date(event!.startAt).getTime())).toBe(false)
    expect(new Date(event!.endAt).getTime() - new Date(event!.startAt).getTime()).toBe(60 * 60_000)
  })

  it('falls back to 09:00 when a legacy event time cannot be parsed', async () => {
    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        events: [{ id: 'legacy-bad-time', title: 'Broken clock event', time: 'not-a-time' }],
      }),
    )

    await migrateLegacyLocalStorage()
    const event = await studyDb.events.get('legacy-bad-time')

    expect(event?.title).toBe('Broken clock event')
    expect(event?.startAt).toMatch(/T09:00:00\.000$/)
  })

  it('skips localStorage import when the migration flag is already set', async () => {
    await studyDb.settings.put({ key: 'legacy-localstorage-migrated-v1', value: true })
    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [{ id: 'late-task', title: 'Should stay out', subject: 'Physics', done: false, minutes: 40 }],
      }),
    )

    await migrateLegacyLocalStorage()

    expect(await studyDb.tasks.count()).toBe(0)
    expect(await studyDb.subjects.count()).toBe(0)
    expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
  })

  it('does not mark migration complete and leaves payload intact when legacy JSON is malformed', async () => {
    localStorage.setItem('study-dashboard-v2', '{not-json')

    const res = await migrateLegacyLocalStorage()

    expect(res.status).toBe('invalid_data')
    expect(await studyDb.tasks.count()).toBe(0)
    expect(await studyDb.subjects.count()).toBe(0)
    expect(await studyDb.events.count()).toBe(0)
    expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBeUndefined()
    expect(localStorage.getItem('study-dashboard-v2')).toBe('{not-json')
  })

  it('marks migration complete without importing empty or title-less legacy payloads', async () => {
    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [{ id: 'blank-task', title: '   ', subject: 'Ignored', done: false }],
        subjects: [{ id: 'blank-subject', name: '  ', progress: 10 }],
        notes: [{ id: 'blank-note', title: '', body: '' }],
        events: [{ id: 'blank-event', title: ' ' }],
        dailyGoalMinutes: 300,
      }),
    )

    await migrateLegacyLocalStorage()

    expect(await studyDb.tasks.count()).toBe(0)
    expect(await studyDb.subjects.count()).toBe(0)
    expect(await studyDb.notes.count()).toBe(0)
    expect(await studyDb.events.count()).toBe(0)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBeUndefined()
    expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
  })

  it('does not re-import legacy localStorage data on a second migration pass', async () => {
    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [{ id: 'once-task', title: 'First import only', subject: 'Biology', done: false, minutes: 20 }],
      }),
    )

    await migrateLegacyLocalStorage()
    expect(await studyDb.tasks.count()).toBe(1)

    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [
          { id: 'once-task', title: 'First import only', subject: 'Biology', done: false, minutes: 20 },
          { id: 'second-task', title: 'Should not appear', subject: 'Biology', done: false, minutes: 15 },
        ],
      }),
    )

    await migrateLegacyLocalStorage()

    expect(await studyDb.tasks.count()).toBe(1)
    expect(await studyDb.tasks.get('second-task')).toBeUndefined()
    expect((await studyDb.tasks.get('once-task'))?.title).toBe('First import only')
  })

  it('infers study_time for General when legacy focus minutes accompany migrated tasks', async () => {
    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [{ id: 'focus-task', title: 'Keep migration non-empty', subject: 'Chemistry', done: false, minutes: 30 }],
        focusMinutes: 45,
      }),
    )

    await migrateLegacyLocalStorage()

    const subjects = await studyDb.subjects.toArray()
    const byName = new Map(subjects.map((subject) => [subject.name, subject]))

    expect(byName.get('Chemistry')?.progressMode).toBe('manual')
    expect(byName.get('General')?.progressMode).toBe('study_time')
    expect(await studyDb.tasks.count()).toBe(1)
    expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
  })

  it('skips the focus-minute subject path when legacy focus minutes are zero', async () => {
    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [{ id: 'zero-focus-task', title: 'No focus credit', subject: 'Chemistry', done: false, minutes: 30 }],
        focusMinutes: 0,
      }),
    )

    await migrateLegacyLocalStorage()

    const subjects = await studyDb.subjects.toArray()
    expect(subjects).toHaveLength(1)
    expect(subjects[0]).toMatchObject({ name: 'Chemistry', progressMode: 'manual' })
    expect(await studyDb.studySessions.count()).toBe(0)
  })

  it('imports a General study_time subject and session from focus-only legacy payloads', async () => {
    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        focusMinutes: 60,
        dailyGoalMinutes: 200,
      }),
    )

    await migrateLegacyLocalStorage()

    const subjects = await studyDb.subjects.toArray()
    expect(subjects).toHaveLength(1)
    expect(subjects[0]).toMatchObject({ name: 'General', progressMode: 'study_time' })

    const sessions = await studyDb.studySessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      subjectId: subjects[0]!.id,
      minutes: 60,
      note: 'Migrated focus time',
    })
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(200)
    expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
  })

  it('clamps migrated legacy focus minutes into a persisted study session', async () => {
    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [{ id: 'focus-task', title: 'Keep migration non-empty', subject: 'Chemistry', done: false, minutes: 30 }],
        focusMinutes: 900,
      }),
    )

    await migrateLegacyLocalStorage()

    const subjects = await studyDb.subjects.toArray()
    const general = subjects.find((subject) => subject.name === 'General')
    expect(general).toBeDefined()

    const sessions = await studyDb.studySessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      subjectId: general!.id,
      minutes: 720,
      note: 'Migrated focus time',
    })
    expect(new Date(sessions[0]!.endedAt).getTime() - new Date(sessions[0]!.startedAt).getTime()).toBe(720 * 60_000)

    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [{ id: 'focus-task', title: 'Keep migration non-empty', subject: 'Chemistry', done: false, minutes: 30 }],
        focusMinutes: 900,
      }),
    )
    await migrateLegacyLocalStorage()
    expect(await studyDb.studySessions.count()).toBe(1)
    expect(await studyDb.tasks.count()).toBe(1)
    expect(await studyDb.subjects.count()).toBe(subjects.length)
  })

  it('returns collision status and rolls back without writing when a legacy ID collides with an existing Dexie record', async () => {
    await studyDb.tasks.add({
      id: 'existing-task-id',
      title: 'Existing DB Task',
      subjectId: '',
      completed: false,
      estimatedMinutes: 30,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [{ id: 'existing-task-id', title: 'Colliding Task', subject: 'Math', done: false, minutes: 15 }],
      }),
    )

    const result = await migrateLegacyLocalStorage()

    expect(result).toEqual({
      status: 'collision',
      entity: 'tasks',
      id: 'existing-task-id',
    })
    expect(await studyDb.tasks.count()).toBe(1)
    expect((await studyDb.tasks.get('existing-task-id'))?.title).toBe('Existing DB Task')
    expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBeUndefined()
    expect(localStorage.getItem('study-dashboard-v2')).not.toBeNull()
  })

  it('returns explicit MigrationResult statuses for already_migrated, no_legacy_data, demo_data_skipped, and success', async () => {
    const noDataResult = await migrateLegacyLocalStorage()
    expect(noDataResult).toEqual({ status: 'no_legacy_data' })

    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [{ id: 'valid-task-1', title: 'Valid Task 1', subject: 'Math', done: false, minutes: 20 }],
      }),
    )

    const successResult = await migrateLegacyLocalStorage()
    expect(successResult).toEqual({ status: 'success', recordCount: 2 })
    expect(localStorage.getItem('study-dashboard-v2')).toBeNull()

    const alreadyMigratedResult = await migrateLegacyLocalStorage()
    expect(alreadyMigratedResult).toEqual({ status: 'already_migrated' })
  })

  it('Scenario 6: deduplicates equivalent incoming duplicate legacy records with differing property insertion order', async () => {
    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [
          { id: 'task-dup-order', title: 'Order Test Task', subject: 'Math', done: false, minutes: 20 },
          { subject: 'Math', done: false, minutes: 20, title: 'Order Test Task', id: 'task-dup-order' },
        ],
        notes: [
          { id: 'note-unrelated', title: 'Unrelated Note', tag: 'Science', body: 'Unrelated note body' },
        ],
      }),
    )

    const result = await migrateLegacyLocalStorage()

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.recordCount).toBe(4)
    }

    const tasks = await studyDb.tasks.toArray()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('task-dup-order')

    const notes = await studyDb.notes.toArray()
    expect(notes).toHaveLength(1)
    expect(notes[0].id).toBe('note-unrelated')

    expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
    expect(localStorage.getItem('study-dashboard-v2')).toBeNull()
  })

  it('Scenario 8: deduplicates structurally equivalent existing IndexedDB rows and completes migration successfully', async () => {
    // Fake only Date so migration stamps deterministic timestamps; faking all
    // timers deadlocks Dexie's scheduler.
    vi.useFakeTimers({ toFake: ['Date'] })
    const fixedNow = new Date('2026-06-01T12:00:00.000Z')
    vi.setSystemTime(fixedNow)

    try {
      // Seeds mirror exactly what migrateLegacyData derives from the legacy
      // payload below (default color, targetHours formula, clamped minutes).
      const timestamp = fixedNow.toISOString()
      const mathSubject = {
        id: 'subject-math-id',
        name: 'Math',
        color: '#111827',
        targetHours: 3,
        progress: 0,
        progressMode: 'manual' as const,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      const seededTask = {
        id: 'task-equiv-1',
        title: 'Equivalent Task',
        subjectId: 'subject-math-id',
        dueDate: '',
        priority: 'normal' as const,
        status: 'open' as const,
        minutes: 30,
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      await studyDb.subjects.add(mathSubject)
      await studyDb.tasks.add(seededTask)

      localStorage.setItem(
        'study-dashboard-v2',
        JSON.stringify({
          subjects: [{ id: 'subject-math-id', name: 'Math', topicsLeft: 2, progress: 0 }],
          tasks: [
            { id: 'task-equiv-1', title: 'Equivalent Task', subject: 'Math', done: false, minutes: 30 },
            { id: 'task-new-2', title: 'New Task 2', subject: 'Math', done: false, minutes: 20 },
          ],
        }),
      )

      const result = await migrateLegacyLocalStorage()

      expect(result.status).toBe('success')
      expect(await studyDb.tasks.count()).toBe(2)
      expect(await studyDb.tasks.get('task-equiv-1')).toEqual(seededTask)
      expect(await studyDb.tasks.get('task-new-2')).toBeDefined()
      expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
      expect(localStorage.getItem('study-dashboard-v2')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('Scenario 10 & 14: rolls back complete pre-operation database snapshot on entity-write failure', async () => {
    await studyDb.tasks.add({
      id: 'task-pre-existing',
      title: 'Pre-existing Task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    })
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 120 })

    const snapshotBefore = await readCompleteStudyDbSnapshot()

    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [{ id: 'task-write-fail', title: 'Fail Task', subject: 'Chem', done: false, minutes: 20 }],
      }),
    )

    const result = await migrateLegacyLocalStorage({ forceEntityWriteError: true })

    expect(result).toEqual({
      status: 'transaction_failed',
      error: 'Forced entity write error',
    })

    const snapshotAfter = await readCompleteStudyDbSnapshot()
    expect(snapshotAfter).toEqual(snapshotBefore)
    expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBeUndefined()
    expect(localStorage.getItem('study-dashboard-v2')).not.toBeNull()
  })

  it('Scenario 11 & 14 & 15: rolls back complete database snapshot on marker-write failure and succeeds on subsequent retry', async () => {
    await studyDb.tasks.add({
      id: 'task-marker-pre',
      title: 'Pre Task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 15,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    })
    const snapshotBefore = await readCompleteStudyDbSnapshot()

    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [{ id: 'task-marker-incoming', title: 'Marker Task', subject: 'History', done: false, minutes: 25 }],
      }),
    )

    const failResult = await migrateLegacyLocalStorage({ forceMarkerWriteError: true })

    expect(failResult).toEqual({
      status: 'transaction_failed',
      error: 'Forced marker write error',
    })

    expect(await readCompleteStudyDbSnapshot()).toEqual(snapshotBefore)
    expect(localStorage.getItem('study-dashboard-v2')).not.toBeNull()

    const retryResult = await migrateLegacyLocalStorage()

    expect(retryResult.status).toBe('success')
    expect(await studyDb.tasks.get('task-marker-incoming')).toBeDefined()
    expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
    expect(localStorage.getItem('study-dashboard-v2')).toBeNull()
  })

  it('Scenario 14 & 15: rolls back complete database snapshot on quota error and succeeds on subsequent retry', async () => {
    await studyDb.tasks.add({
      id: 'task-quota-pre',
      title: 'Quota Pre Task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 20,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    })
    const snapshotBefore = await readCompleteStudyDbSnapshot()

    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [{ id: 'quota-task', title: 'Quota Task', subject: 'Physics', done: false, minutes: 25 }],
      }),
    )

    const result = await migrateLegacyLocalStorage({ forceQuotaError: true })

    expect(result.status).toBe('transaction_failed')
    if (result.status === 'transaction_failed') {
      expect(result.error).toContain('QuotaExceededError')
    }
    expect(await readCompleteStudyDbSnapshot()).toEqual(snapshotBefore)
    expect(localStorage.getItem('study-dashboard-v2')).not.toBeNull()

    // Retry
    const retryResult = await migrateLegacyLocalStorage()
    expect(retryResult.status).toBe('success')
    expect(await studyDb.tasks.get('quota-task')).toBeDefined()
    expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
    expect(localStorage.getItem('study-dashboard-v2')).toBeNull()
  })

  it('Scenario 14 & 15: rolls back complete database snapshot on explicit abort and succeeds on subsequent retry', async () => {
    await studyDb.tasks.add({
      id: 'task-abort-pre',
      title: 'Abort Pre Task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 20,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    })
    const snapshotBefore = await readCompleteStudyDbSnapshot()

    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [{ id: 'abort-task', title: 'Abort Task', subject: 'Biology', done: false, minutes: 20 }],
      }),
    )

    const result = await migrateLegacyLocalStorage({ abortTransaction: true })

    expect(result).toEqual({
      status: 'transaction_failed',
      error: 'Explicit transaction abort',
    })
    expect(await readCompleteStudyDbSnapshot()).toEqual(snapshotBefore)
    expect(localStorage.getItem('study-dashboard-v2')).not.toBeNull()

    // Retry
    const retryResult = await migrateLegacyLocalStorage()
    expect(retryResult.status).toBe('success')
    expect(await studyDb.tasks.get('abort-task')).toBeDefined()
    expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
    expect(localStorage.getItem('study-dashboard-v2')).toBeNull()
  })

  it('Scenario 19: enforces in-transaction marker recheck to prevent concurrent migration invocations from duplicating writes', async () => {
    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [{ id: 'race-task', title: 'Race Task', subject: 'Math', done: false, minutes: 15 }],
      }),
    )

    // Verify initial migration marker is undefined (fast path will pass)
    expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBeUndefined()

    // Fast path passes, but before transaction acquisition the marker is set (simulating concurrent execution)
    const result = await migrateLegacyLocalStorage({
      beforeTransactionAcquisition: async () => {
        await studyDb.settings.put({ key: 'legacy-localstorage-migrated-v1', value: true })
      },
    })

    expect(result).toEqual({ status: 'already_migrated' })
    expect(await studyDb.tasks.count()).toBe(0)
    expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
  })

  it('Scenarios 18 & 53: retries legacy storage cleanup on subsequent invocation without re-importing data', async () => {
    localStorage.setItem(
      'study-dashboard-v2',
      JSON.stringify({
        tasks: [{ id: 'cleanup-retry-task', title: 'Cleanup Retry Task', subject: 'Art', done: false, minutes: 10 }],
      }),
    )

    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Storage write protected')
    })

    try {
      const result1 = await migrateLegacyLocalStorage()
      expect(result1).toEqual({ status: 'cleanup_failed' })
      expect(await studyDb.tasks.count()).toBe(1)
      expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
      expect(localStorage.getItem('study-dashboard-v2')).not.toBeNull()
    } finally {
      removeItemSpy.mockRestore()
    }

    const result2 = await migrateLegacyLocalStorage()

    expect(result2).toEqual({ status: 'already_migrated' })
    expect(await studyDb.tasks.count()).toBe(1)
    expect(await studyDb.tasks.get('cleanup-retry-task')).toBeDefined()
    expect(localStorage.getItem('study-dashboard-v2')).toBeNull()
  })

  it('Scenario 43 & 14: rolls back complete import replacement when forced settings put fails', async () => {
    await studyDb.tasks.add({
      id: 'task-pre-import',
      title: 'Pre-import Task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 20,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    })
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 180 })

    const snapshotBefore = await readCompleteStudyDbSnapshot()

    const validPayload = {
      version: 3,
      exportedAt: '2026-07-01T00:00:00.000Z',
      tasks: [{ id: 'new-task', title: 'New Task', subjectId: '', dueDate: '', priority: 'normal', status: 'open', minutes: 15, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z' }],
      subjects: [],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
      settings: [],
    }

    await expect(importStudyData(validPayload, { forceSettingsPutError: true })).rejects.toThrow(
      'Database storage transaction failed during import.'
    )

    const snapshotAfter = await readCompleteStudyDbSnapshot()
    expect(snapshotAfter).toEqual(snapshotBefore)
  })

  it('Scenario 36: enforces file-size, text-length, and record-count limits independently before database mutation', async () => {
    await studyDb.tasks.add({
      id: 'task-limit-keep',
      title: 'Limit Keep',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 20,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    })
    const snapshotBefore = await readCompleteStudyDbSnapshot()

    const hugeFile = new File(['x'], 'huge.json', { type: 'application/json' })
    Object.defineProperty(hugeFile, 'size', { value: 6 * 1024 * 1024 })
    expect(() => assertStudyExportImportFileSize(hugeFile)).toThrow('Import file exceeds the Study Dashboard size limit.')

    const hugeText = 'x'.repeat(6 * 1024 * 1024)
    expect(() => assertStudyExportImportTextLength(hugeText)).toThrow('Import file exceeds the Study Dashboard size limit.')

    const overLimitPayload = {
      version: 3,
      exportedAt: '2026-07-01T00:00:00.000Z',
      tasks: Array.from({ length: 5001 }, (_, i) => ({
        id: `t-${i}`,
        title: `Task ${i}`,
        subjectId: '',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: 10,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      })),
      subjects: [],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
      settings: [],
    }

    await expect(importStudyData(overLimitPayload)).rejects.toThrow('Import file is not a Study Dashboard export.')

    expect(await readCompleteStudyDbSnapshot()).toEqual(snapshotBefore)
  })
})

describe('goal metric Dexie version 2 upgrade', () => {
  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('upgrades version-1 goals with inferred metrics and preserves fields', async () => {
    const timestamp = '2026-07-21T10:00:00.000Z'
    await seedVersion1Goals([
      {
        id: 'goal-daily-focus',
        title: 'Daily Focus',
        target: 120,
        progress: 15,
        period: 'daily',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'goal-weekly-study',
        title: 'Weekly study hours',
        target: 10,
        progress: 2,
        period: 'weekly',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'goal-weekly-focus',
        title: 'Focus week',
        target: 8,
        progress: 1,
        period: 'weekly',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'goal-daily-study-only',
        title: 'Study 2 hours daily',
        target: 120,
        progress: 40,
        period: 'daily',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'goal-weekly-manual',
        title: 'Read chapters',
        target: 5,
        progress: 1,
        period: 'weekly',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'goal-monthly-focus',
        title: 'Monthly focus',
        target: 20,
        progress: 3,
        period: 'monthly',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'goal-preassigned-manual',
        title: 'Daily focus',
        target: 90,
        progress: 0,
        period: 'daily',
        metric: 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ])

    await studyDb.open()
    expect(studyDb.verno).toBe(3)

    const goals = await studyDb.goals.toArray()
    const byId = new Map(goals.map((goal) => [goal.id, goal]))

    expect(byId.get('goal-daily-focus')).toEqual({
      id: 'goal-daily-focus',
      title: 'Daily Focus',
      target: 120,
      progress: 15,
      period: 'daily',
      metric: 'study_time',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    expect(byId.get('goal-weekly-study')?.metric).toBe('study_time')
    expect(byId.get('goal-weekly-focus')?.metric).toBe('study_time')
    expect(byId.get('goal-daily-study-only')?.metric).toBe('manual')
    expect(byId.get('goal-weekly-manual')?.metric).toBe('manual')
    expect(byId.get('goal-monthly-focus')?.metric).toBe('manual')
    expect(byId.get('goal-preassigned-manual')).toEqual({
      id: 'goal-preassigned-manual',
      title: 'Daily focus',
      target: 90,
      progress: 0,
      period: 'daily',
      metric: 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  })

  it('does not reinfer metrics on reopen or after renaming a migrated goal', async () => {
    const timestamp = '2026-07-21T11:00:00.000Z'
    await seedVersion1Goals([
      {
        id: 'goal-stable-metric',
        title: 'Daily focus',
        target: 60,
        progress: 10,
        period: 'daily',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ])

    await studyDb.open()
    expect((await studyDb.goals.get('goal-stable-metric'))?.metric).toBe('study_time')

    studyDb.close()
    await studyDb.open()
    expect((await studyDb.goals.get('goal-stable-metric'))?.metric).toBe('study_time')

    await studyDb.goals.update('goal-stable-metric', {
      title: 'Renamed without focus word',
      updatedAt: '2026-07-21T12:00:00.000Z',
    })

    studyDb.close()
    await studyDb.open()

    const renamed = await studyDb.goals.get('goal-stable-metric') as StudyGoal
    expect(renamed.title).toBe('Renamed without focus word')
    expect(renamed.metric).toBe('study_time')
    expect(renamed.target).toBe(60)
    expect(renamed.progress).toBe(10)
    expect(renamed.createdAt).toBe(timestamp)
  })
})

describe('subject progressMode Dexie version 3 upgrade', () => {
  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('assigns study_time when matching session minutes are positive and manual otherwise', async () => {
    const timestamp = '2026-07-21T10:00:00.000Z'
    await seedVersion1SubjectsAndSessions(
      [
        {
          id: 'subject-logged',
          name: 'Physics',
          color: '#2563eb',
          targetHours: 4,
          progress: 20,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: 'subject-empty',
          name: 'Biology',
          color: '#0f766e',
          targetHours: 3,
          progress: 55,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: 'subject-preassigned',
          name: 'Chemistry',
          color: '#b45309',
          targetHours: 2,
          progress: 10,
          progressMode: 'manual',
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      [
        {
          id: 'session-physics',
          subjectId: 'subject-logged',
          startedAt: timestamp,
          endedAt: timestamp,
          minutes: 45,
          note: 'Practice',
        },
        {
          id: 'session-zero',
          subjectId: 'subject-empty',
          startedAt: timestamp,
          endedAt: timestamp,
          minutes: 0,
          note: 'Empty',
        },
      ],
    )

    await studyDb.open()
    expect(studyDb.verno).toBe(3)

    const subjects = await studyDb.subjects.toArray()
    const byId = new Map(subjects.map((subject) => [subject.id, subject]))

    expect(byId.get('subject-logged')).toMatchObject({
      id: 'subject-logged',
      name: 'Physics',
      targetHours: 4,
      progress: 20,
      progressMode: 'study_time',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    expect(byId.get('subject-empty')).toMatchObject({
      progress: 55,
      progressMode: 'manual',
    })
    expect(byId.get('subject-preassigned')).toMatchObject({
      progress: 10,
      progressMode: 'manual',
    })
  })

  it('does not reassign valid modes on reopen', async () => {
    const timestamp = '2026-07-21T11:00:00.000Z'
    await seedVersion1SubjectsAndSessions(
      [
        {
          id: 'subject-stable',
          name: 'Stable',
          color: '#111827',
          targetHours: 2,
          progress: 30,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      [
        {
          id: 'session-stable',
          subjectId: 'subject-stable',
          startedAt: timestamp,
          endedAt: timestamp,
          minutes: 60,
          note: 'Logged',
        },
      ],
    )

    await studyDb.open()
    expect((await studyDb.subjects.get('subject-stable'))?.progressMode).toBe('study_time')

    await studyDb.subjects.update('subject-stable', { progressMode: 'manual', progress: 30 })
    studyDb.close()
    await studyDb.open()

    const subject = await studyDb.subjects.get('subject-stable')
    expect(subject?.progressMode).toBe('manual')
    expect(subject?.progress).toBe(30)
    expect(subject?.targetHours).toBe(2)
  })

  describe('P2-S3: Backup Export/Import Round-Trip Suite', () => {
    beforeEach(async () => {
      localStorage.clear()
      if (!studyDb.isOpen()) {
        await studyDb.open()
      }
      await studyDb.delete()
      await studyDb.open()
    })

    it('P2-S3: preserves all 8 tables, subject references, and settings across full v3 round trip with explicit production ordering', async () => {
      const t1 = '2026-07-28T10:00:00.000Z'
      const t2 = '2026-07-28T11:00:00.000Z'

      // Intentionally insert out-of-order to test production query ordering
      // Subjects: orderBy('createdAt') -> subj-a (t1) should precede subj-b (t2)
      await studyDb.subjects.bulkAdd([
        {
          id: 'subj-b',
          name: 'Physics',
          color: '#16a34a',
          targetHours: 8,
          progress: 0,
          progressMode: 'study_time',
          createdAt: t2,
          updatedAt: t2,
        },
        {
          id: 'subj-a',
          name: 'Mathematics',
          color: '#2563eb',
          targetHours: 10,
          progress: 45,
          progressMode: 'manual',
          createdAt: t1,
          updatedAt: t1,
        },
      ])

      // Tasks: orderBy('createdAt') -> task-a (t1) should precede task-b (t2)
      await studyDb.tasks.bulkAdd([
        {
          id: 'task-b',
          title: 'Physics reading',
          subjectId: 'subj-b',
          dueDate: '',
          priority: 'normal',
          status: 'done',
          minutes: 45,
          createdAt: t2,
          updatedAt: t2,
        },
        {
          id: 'task-a',
          title: 'Math exercises',
          subjectId: 'subj-a',
          dueDate: '2026-07-30',
          priority: 'high',
          status: 'open',
          minutes: 60,
          createdAt: t1,
          updatedAt: t1,
        },
      ])

      // Notes: orderBy('updatedAt').reverse() -> note-b (t2) should precede note-a (t1)
      await studyDb.notes.bulkAdd([
        {
          id: 'note-a',
          title: 'Calculus formulas',
          body: 'Integral rules and derivatives.',
          subjectId: 'subj-a',
          tags: ['math'],
          createdAt: t1,
          updatedAt: t1,
        },
        {
          id: 'note-b',
          title: 'General study tips',
          body: 'Spaced repetition schedule.',
          subjectId: '',
          tags: ['tips'],
          createdAt: t2,
          updatedAt: t2,
        },
      ])

      // Events: orderBy('startAt') -> event-a (Aug 1) should precede event-b (Aug 2)
      await studyDb.events.bulkAdd([
        {
          id: 'event-b',
          title: 'Physics lab',
          subjectId: 'subj-b',
          startAt: '2026-08-02T09:00:00.000Z',
          endAt: '2026-08-02T11:00:00.000Z',
          location: 'Lab B',
          createdAt: t2,
          updatedAt: t2,
        },
        {
          id: 'event-a',
          title: 'Math exam',
          subjectId: 'subj-a',
          startAt: '2026-08-01T09:00:00.000Z',
          endAt: '2026-08-01T11:00:00.000Z',
          location: 'Hall A',
          createdAt: t1,
          updatedAt: t1,
        },
      ])

      // Flashcards: orderBy('createdAt') -> card-a (t1) should precede card-b (t2)
      await studyDb.flashcards.bulkAdd([
        {
          id: 'card-b',
          front: 'Kinematics Formula',
          back: 'v = u + at',
          subjectId: 'subj-b',
          status: 'new',
          lastReviewedAt: '',
          dueAt: t2,
          intervalDays: 0,
          reviewCount: 0,
          createdAt: t2,
          updatedAt: t2,
        },
        {
          id: 'card-a',
          front: 'Newton Second Law',
          back: 'F = ma',
          subjectId: 'subj-a',
          status: 'remembered',
          lastReviewedAt: t1,
          dueAt: '2026-07-29T10:00:00.000Z',
          intervalDays: 1,
          reviewCount: 3,
          createdAt: t1,
          updatedAt: t1,
        },
      ])

      // StudySessions: orderBy('startedAt').reverse() -> session-b (09:00) should precede session-a (08:00)
      await studyDb.studySessions.bulkAdd([
        {
          id: 'session-a',
          subjectId: 'subj-b',
          startedAt: '2026-07-28T08:00:00.000Z',
          endedAt: '2026-07-28T09:00:00.000Z',
          minutes: 60,
          note: 'Kinematics practice',
        },
        {
          id: 'session-b',
          subjectId: 'subj-a',
          startedAt: '2026-07-28T09:00:00.000Z',
          endedAt: '2026-07-28T10:00:00.000Z',
          minutes: 60,
          note: 'Calculus practice',
        },
      ])

      // Goals: orderBy('createdAt') -> goal-a (t1) should precede goal-b (t2)
      await studyDb.goals.bulkAdd([
        {
          id: 'goal-b',
          title: 'Daily Physics Study',
          target: 60,
          progress: 60,
          period: 'daily',
          metric: 'study_time',
          createdAt: t2,
          updatedAt: t2,
        },
        {
          id: 'goal-a',
          title: 'Weekly Math Practice',
          target: 300,
          progress: 120,
          period: 'weekly',
          metric: 'manual',
          createdAt: t1,
          updatedAt: t1,
        },
      ])

      await studyDb.settings.bulkAdd([
        { key: 'legacy-localstorage-migrated-v1', value: true },
        { key: 'dailyGoalMinutes', value: 180 },
        { key: 'quickNotes', value: ['QN1', 'QN2', 'QN3', 'QN4', 'QN5', 'QN6', 'QN7', 'QN8'] },
        { key: 'onboardingChecklistDismissed', value: true },
        {
          key: 'activeFocusSession',
          value: {
            id: 'focus-running-1',
            subjectId: 'subj-a',
            startedAt: t1,
            plannedMinutes: 25,
            status: 'running',
            pausedAt: null,
            accumulatedPausedMs: 0,
          },
        },
      ])

      const exportPayload = await exportStudyData()

      // Explicitly pass through public parser / normalizer
      const parsedJson = JSON.parse(JSON.stringify(exportPayload))
      const normalizedPayload = parseAndNormalizeStudyExport(parsedJson)

      expect(normalizedPayload.version).toBe(3)
      expect(typeof normalizedPayload.exportedAt).toBe('string')
      expect(normalizedPayload.exportedAt.length).toBeGreaterThan(0)

      // Direct ordering assertions on exported payload
      expect(normalizedPayload.subjects.map((s) => s.id)).toEqual(['subj-a', 'subj-b'])
      expect(normalizedPayload.tasks.map((t) => t.id)).toEqual(['task-a', 'task-b'])
      expect(normalizedPayload.notes.map((n) => n.id)).toEqual(['note-b', 'note-a'])
      expect(normalizedPayload.events.map((e) => e.id)).toEqual(['event-a', 'event-b'])
      expect(normalizedPayload.flashcards.map((c) => c.id)).toEqual(['card-a', 'card-b'])
      expect(normalizedPayload.studySessions.map((s) => s.id)).toEqual(['session-b', 'session-a'])
      expect(normalizedPayload.goals.map((g) => g.id)).toEqual(['goal-a', 'goal-b'])

      await clearAllStudyData()
      await importStudyData(normalizedPayload)

      const restored = await getStudyData()

      // Assert independent expected restored states
      expect(restored.subjects).toEqual([
        {
          id: 'subj-a',
          name: 'Mathematics',
          color: '#2563eb',
          targetHours: 10,
          progress: 45,
          progressMode: 'manual',
          createdAt: t1,
          updatedAt: t1,
        },
        {
          id: 'subj-b',
          name: 'Physics',
          color: '#16a34a',
          targetHours: 8,
          progress: 0,
          progressMode: 'study_time',
          createdAt: t2,
          updatedAt: t2,
        },
      ])

      expect(restored.tasks).toEqual([
        {
          id: 'task-a',
          title: 'Math exercises',
          subjectId: 'subj-a',
          dueDate: '2026-07-30',
          priority: 'high',
          status: 'open',
          minutes: 60,
          createdAt: t1,
          updatedAt: t1,
        },
        {
          id: 'task-b',
          title: 'Physics reading',
          subjectId: 'subj-b',
          dueDate: '',
          priority: 'normal',
          status: 'done',
          minutes: 45,
          createdAt: t2,
          updatedAt: t2,
        },
      ])

      expect(restored.notes.map((n) => n.id)).toEqual(['note-b', 'note-a'])
      expect(restored.events.map((e) => e.id)).toEqual(['event-a', 'event-b'])
      expect(restored.flashcards).toEqual([
        {
          id: 'card-a',
          front: 'Newton Second Law',
          back: 'F = ma',
          subjectId: 'subj-a',
          status: 'remembered',
          lastReviewedAt: t1,
          dueAt: '2026-07-29T10:00:00.000Z',
          intervalDays: 1,
          reviewCount: 3,
          createdAt: t1,
          updatedAt: t1,
        },
        {
          id: 'card-b',
          front: 'Kinematics Formula',
          back: 'v = u + at',
          subjectId: 'subj-b',
          status: 'new',
          lastReviewedAt: '',
          dueAt: t2,
          intervalDays: 0,
          reviewCount: 0,
          createdAt: t2,
          updatedAt: t2,
        },
      ])
      expect(restored.studySessions.map((s) => s.id)).toEqual(['session-b', 'session-a'])
      expect(restored.goals.map((g) => g.id)).toEqual(['goal-a', 'goal-b'])

      const settingsMap = new Map(restored.settings.map((s) => [s.key, s.value]))
      expect(settingsMap.get('legacy-localstorage-migrated-v1')).toBe(true)
      expect(settingsMap.get('dailyGoalMinutes')).toBe(180)
      expect(settingsMap.get('quickNotes')).toEqual(['QN1', 'QN2', 'QN3', 'QN4', 'QN5', 'QN6', 'QN7', 'QN8'])
      expect(settingsMap.get('onboardingChecklistDismissed')).toBe(true)
      expect(settingsMap.get('activeFocusSession')).toEqual({
        id: 'focus-running-1',
        subjectId: 'subj-a',
        startedAt: t1,
        plannedMinutes: 25,
        status: 'running',
        pausedAt: null,
        accumulatedPausedMs: 0,
      })
    })

    it('P2-S3: exports and imports an empty database cleanly', async () => {
      await clearAllStudyData()
      await studyDb.settings.clear()

      const emptyExport = await exportStudyData()
      const normalizedEmpty = parseAndNormalizeStudyExport(JSON.parse(JSON.stringify(emptyExport)))

      expect(normalizedEmpty.version).toBe(3)
      expect(typeof normalizedEmpty.exportedAt).toBe('string')
      expect(normalizedEmpty.tasks).toEqual([])
      expect(normalizedEmpty.subjects).toEqual([])
      expect(normalizedEmpty.notes).toEqual([])
      expect(normalizedEmpty.events).toEqual([])
      expect(normalizedEmpty.flashcards).toEqual([])
      expect(normalizedEmpty.studySessions).toEqual([])
      expect(normalizedEmpty.goals).toEqual([])
      expect(normalizedEmpty.settings).toEqual([])

      const timestamp = nowIso()
      await studyDb.tasks.add({
        id: 'temp-task',
        title: 'Temporary Task',
        subjectId: '',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: 15,
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      await importStudyData(normalizedEmpty)

      const restored = await getStudyData()
      expect(restored.tasks).toEqual([])
      expect(restored.subjects).toEqual([])
      expect(restored.notes).toEqual([])
      expect(restored.events).toEqual([])
      expect(restored.flashcards).toEqual([])
      expect(restored.studySessions).toEqual([])
      expect(restored.goals).toEqual([])
    })

    it('P2-S3: exports and imports large valid multiline and Unicode text fixtures using production byte and character limits', async () => {
      const timestamp = nowIso()
      const multilineUnicodeSegment = '## Section Header 🎓\nStudy notes with code snippets: `const x = 42;` and emojis: ⚡ 📚 🔬\n'
      const largeNoteBody = multilineUnicodeSegment.repeat(600)

      await studyDb.notes.add({
        id: 'note-large',
        title: 'Large Unicode Note 🚀',
        body: largeNoteBody,
        subjectId: '',
        tags: ['large', 'unicode'],
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      const exportPayload = await exportStudyData()
      const serializedJson = JSON.stringify(exportPayload, null, 2)

      const normalized = parseAndNormalizeStudyExport(JSON.parse(serializedJson))
      expect(normalized.notes[0]?.body).toBe(largeNoteBody)

      // Use production TextEncoder UTF-8 byte length and string char length against production constants
      const byteLength = new TextEncoder().encode(serializedJson).byteLength
      const charLength = serializedJson.length

      expect(byteLength).toBeLessThan(MAX_STUDY_EXPORT_IMPORT_BYTES)
      expect(charLength).toBeLessThan(MAX_STUDY_EXPORT_IMPORT_CHARS)
      expect(byteLength).toBeGreaterThan(50_000)

      await clearAllStudyData()
      await importStudyData(normalized)

      const restored = await getStudyData()
      expect(restored.notes).toHaveLength(1)
      expect(restored.notes[0]?.title).toBe('Large Unicode Note 🚀')
      expect(restored.notes[0]?.body).toBe(largeNoteBody)
    })

    it('P2-S3: preserves paused activeFocusSession variant across export and import', async () => {
      const timestamp = nowIso()
      const activeFocusPaused: ActiveFocusSession = {
        id: 'focus-paused-123',
        subjectId: 'subj-focus-paused',
        startedAt: timestamp,
        plannedMinutes: 60,
        status: 'paused',
        pausedAt: timestamp,
        accumulatedPausedMs: 120_000,
      }

      await studyDb.subjects.add({
        id: 'subj-focus-paused',
        name: 'Focus Subject Paused',
        color: '#3b82f6',
        targetHours: 5,
        progress: 10,
        progressMode: 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      await studyDb.settings.bulkAdd([
        { key: 'dailyGoalMinutes', value: 240 },
        { key: 'quickNotes', value: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'] },
        { key: 'onboardingChecklistDismissed', value: true },
        { key: 'legacy-localstorage-migrated-v1', value: true },
        { key: 'activeFocusSession', value: activeFocusPaused },
      ])

      const exportPayload = await exportStudyData()
      const normalized = parseAndNormalizeStudyExport(JSON.parse(JSON.stringify(exportPayload)))

      await clearAllStudyData()
      await importStudyData(normalized)

      const restored = await getStudyData()
      const settingsMap = new Map(restored.settings.map((s) => [s.key, s.value]))

      expect(settingsMap.get('dailyGoalMinutes')).toBe(240)
      expect(settingsMap.get('quickNotes')).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'])
      expect(settingsMap.get('onboardingChecklistDismissed')).toBe(true)
      expect(settingsMap.get('legacy-localstorage-migrated-v1')).toBe(true)
      expect(settingsMap.get('activeFocusSession')).toEqual(activeFocusPaused)
    })

    it('P2-S3: retains subject references across exported entities and verifies link integrity', async () => {
      const timestamp = nowIso()
      await studyDb.subjects.add({
        id: 'subj-linked',
        name: 'Linked Subject',
        color: '#ef4444',
        targetHours: 4,
        progress: 0,
        progressMode: 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      await studyDb.tasks.add({
        id: 'task-linked',
        title: 'Linked Task',
        subjectId: 'subj-linked',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: 30,
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      await studyDb.notes.add({
        id: 'note-linked',
        title: 'Linked Note',
        body: 'Content',
        subjectId: 'subj-linked',
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      const exportPayload = await exportStudyData()
      const normalized = parseAndNormalizeStudyExport(JSON.parse(JSON.stringify(exportPayload)))

      await clearAllStudyData()
      await importStudyData(normalized)

      const restored = await getStudyData()
      const restoredSubjectIds = new Set(restored.subjects.map((s) => s.id))

      expect(restoredSubjectIds.has('subj-linked')).toBe(true)
      expect(restored.tasks[0]?.subjectId).toBe('subj-linked')
      expect(restored.notes[0]?.subjectId).toBe('subj-linked')
    })

    it('P2-S4: captures a coherent snapshot under concurrent write from a second connection', async () => {
      let snapshotGateResolver!: () => void
      const snapshotGatePromise = new Promise<void>((r) => {
        snapshotGateResolver = r
      })

      let writerNativeIssuedResolver!: () => void
      const writerNativeIssuedPromise = new Promise<void>((r) => {
        writerNativeIssuedResolver = r
      })

      let snapshotStarted = false
      let writerStatus: 'pending' | 'fulfilled' | 'rejected' = 'pending'
      let writerError: unknown = null
      let observedNativeMode: string | null = null
      let observedNativeStores: string[] = []

      let snapshotPromise: Promise<unknown> | null = null
      let writePromise: Promise<void> | null = null
      let origAppTransactionSpy: ReturnType<typeof vi.spyOn> | null = null
      let origNativeTransactionSpy: ReturnType<typeof vi.spyOn> | null = null
      let studyDb2: StudyDatabase | null = null

      try {
        const timestamp = nowIso()

        // Seed coherent State A (Subject A + Task A referencing Subject A)
        await studyDb.subjects.add({
          id: 'subj-a',
          name: 'Mathematics',
          color: '#2563eb',
          targetHours: 10,
          progress: 0,
          progressMode: 'manual',
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        await studyDb.tasks.add({
          id: 'task-a',
          title: 'Math exercises',
          subjectId: 'subj-a',
          dueDate: '',
          priority: 'normal',
          status: 'open',
          minutes: 60,
          createdAt: timestamp,
          updatedAt: timestamp,
        })

        // Verify initial state A passes validation
        const initialData = await getStudyData()
        expect(initialData.subjects.map((s) => s.id)).toEqual(['subj-a'])
        expect(initialData.tasks.map((t) => t.id)).toEqual(['task-a'])

        // Spy on Connection A transaction to hold it open via Dexie.waitFor after reads execute
        const origAppTransaction = studyDb.transaction.bind(studyDb)
        origAppTransactionSpy = vi.spyOn(studyDb, 'transaction').mockImplementation((mode: unknown, ...args: unknown[]) => {
          const callback = args[args.length - 1] as () => Promise<unknown>
          args[args.length - 1] = async () => {
            snapshotStarted = true
            const result = await callback()
            await Dexie.waitFor(snapshotGatePromise)
            return result
          }
          return (origAppTransaction as (...a: unknown[]) => unknown)(mode, ...args) as Promise<unknown>
        })

        // 1. Install native IDBDatabase.prototype.transaction spy BEFORE constructing/opening Connection B
        const origNativeTransaction = globalThis.IDBDatabase.prototype.transaction
        origNativeTransactionSpy = vi
          .spyOn(globalThis.IDBDatabase.prototype, 'transaction')
          .mockImplementation(function (this: IDBDatabase, storeNames: string | string[], mode?: IDBTransactionMode) {
            const storeArray = Array.isArray(storeNames) ? storeNames : Array.from(storeNames)
            if (
              studyDb2 &&
              this === (studyDb2 as unknown as { idbdb: IDBDatabase }).idbdb &&
              mode === 'readwrite' &&
              storeArray.includes('subjects') &&
              storeArray.includes('tasks')
            ) {
              observedNativeMode = mode
              observedNativeStores = storeArray
              writerNativeIssuedResolver()
            }
            return origNativeTransaction.call(this, storeNames, mode)
          })

        // Construct and open Connection B while native spy is active
        studyDb2 = new StudyDatabase()
        await studyDb2.open()

        // 2. Start snapshot transaction on Connection A
        snapshotPromise = readStudyDataSnapshot()
        await vi.waitFor(() => expect(snapshotStarted).toBe(true))

        // 3. Start concurrent atomic State B write on Connection B (replace Subject A/Task A with Subject B/Task B)
        const targetDb2 = studyDb2
        writePromise = targetDb2
          .transaction('rw', [targetDb2.subjects, targetDb2.tasks], async () => {
            await targetDb2.subjects.delete('subj-a')
            await targetDb2.tasks.delete('task-a')
            await targetDb2.subjects.add({
              id: 'subj-b',
              name: 'Physics',
              color: '#16a34a',
              targetHours: 8,
              progress: 0,
              progressMode: 'manual',
              createdAt: timestamp,
              updatedAt: timestamp,
            })
            await targetDb2.tasks.add({
              id: 'task-b',
              title: 'Physics reading',
              subjectId: 'subj-b',
              dueDate: '',
              priority: 'normal',
              status: 'open',
              minutes: 45,
              createdAt: timestamp,
              updatedAt: timestamp,
            })
          })
          .then(() => {
            writerStatus = 'fulfilled'
          })
          .catch((err) => {
            writerStatus = 'rejected'
            writerError = err
          })

        // 4. Directly prove Connection B's native IDBDatabase.transaction() request was issued
        await writerNativeIssuedPromise
        expect(observedNativeMode).toBe('readwrite')
        expect(observedNativeStores).toEqual(expect.arrayContaining(['subjects', 'tasks']))

        // 5. Assert writer is explicitly pending (not fulfilled or rejected) while snapshot gate is held
        expect(writerStatus).toBe('pending')
        expect(writerError).toBeNull()

        // 6. Release snapshot gate and await both promises
        snapshotGateResolver()
        const snapshot = await snapshotPromise
        await writePromise

        // 7. Assert snapshot returned 100% untorn State A
        expect(snapshot.subjects.map((s) => s.id)).toEqual(['subj-a'])
        expect(snapshot.tasks.map((t) => t.id)).toEqual(['task-a'])
        expect(snapshot.tasks[0]?.subjectId).toBe('subj-a')
        expect(snapshot.subjects.some((s) => s.id === 'subj-b')).toBe(false)
        expect(snapshot.tasks.some((t) => t.id === 'task-b')).toBe(false)

        // 8. Assert writer completed after release and live DB reflects 100% untorn State B
        expect(writerStatus).toBe('fulfilled')
        expect(writerError).toBeNull()
        const liveData = await getStudyData()
        expect(liveData.subjects.map((s) => s.id)).toEqual(['subj-b'])
        expect(liveData.tasks.map((t) => t.id)).toEqual(['task-b'])
        expect(liveData.tasks[0]?.subjectId).toBe('subj-b')
        expect(liveData.subjects.some((s) => s.id === 'subj-a')).toBe(false)
        expect(liveData.tasks.some((t) => t.id === 'task-a')).toBe(false)
      } finally {
        snapshotGateResolver()
        if (snapshotPromise || writePromise) {
          await Promise.allSettled([snapshotPromise, writePromise].filter(Boolean))
        }
        origAppTransactionSpy?.mockRestore()
        origNativeTransactionSpy?.mockRestore()
        studyDb2?.close()
      }
    })
  })

  describe('S4 complete-replacement settings partition and stale-source protection', () => {
    beforeEach(async () => {
      localStorage.clear()
      if (!studyDb.isOpen()) {
        await studyDb.open()
      }
      await clearAllStudyData()
      await studyDb.settings.clear()
    })

    const timestamp = '2026-08-05T12:00:00.000Z'
    const validV3Payload = {
      version: 3 as const,
      exportedAt: timestamp,
      appVersion: '1.4.0',
      tasks: [
        {
          id: 'task-imported',
          title: 'Imported task',
          subjectId: '',
          dueDate: '',
          priority: 'normal' as const,
          status: 'open' as const,
          minutes: 30,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      subjects: [],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
      settings: [{ key: 'dailyGoalMinutes', value: 300 }],
    }

    it('1. import succeeds when backup has no migration marker', async () => {
      const result = await importStudyData(validV3Payload)
      expect(result).toEqual({})
      expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
      expect((await studyDb.tasks.toArray())).toHaveLength(1)
    })

    it('2. successful import always stores marker true', async () => {
      const payloadWithMarker = {
        ...validV3Payload,
        settings: [
          { key: 'legacy-localstorage-migrated-v1', value: true },
          { key: 'dailyGoalMinutes', value: 240 },
        ],
      }
      await importStudyData(payloadWithMarker)
      expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
    })

    it('3. imported marker true cannot create a duplicate marker row', async () => {
      const payloadWithMarker = {
        ...validV3Payload,
        settings: [
          { key: 'legacy-localstorage-migrated-v1', value: true },
          { key: 'dailyGoalMinutes', value: 240 },
        ],
      }
      await importStudyData(payloadWithMarker)
      const rows = await studyDb.settings.where('key').equals('legacy-localstorage-migrated-v1').toArray()
      expect(rows).toHaveLength(1)
      expect(rows[0]?.value).toBe(true)
    })

    it('4. imported marker false or malformed value is rejected before mutation', async () => {
      await studyDb.tasks.add({
        id: 'task-existing',
        title: 'Existing task',
        subjectId: '',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: 30,
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      const invalidPayload = {
        ...validV3Payload,
        settings: [{ key: 'legacy-localstorage-migrated-v1', value: false }],
      }

      await expect(importStudyData(invalidPayload)).rejects.toThrow('Import file is not a Study Dashboard export.')
      expect(await studyDb.tasks.toArray()).toMatchObject([{ id: 'task-existing' }])
    })

    it('5. stale study-dashboard-v2 is removed only after successful commit', async () => {
      localStorage.setItem('study-dashboard-v2', '{"tasks":[]}')
      await importStudyData(validV3Payload)
      expect(localStorage.getItem('study-dashboard-v2')).toBeNull()
    })

    it('6. stale source remains after validation failure', async () => {
      localStorage.setItem('study-dashboard-v2', '{"tasks":[]}')
      const invalidPayload = { ...validV3Payload, version: 99 }
      await expect(importStudyData(invalidPayload)).rejects.toThrow()
      expect(localStorage.getItem('study-dashboard-v2')).toBe('{"tasks":[]}')
    })

    it('7. stale source remains after transaction rollback', async () => {
      localStorage.setItem('study-dashboard-v2', '{"tasks":[]}')
      await expect(importStudyData(validV3Payload, { abortTransaction: true })).rejects.toThrow()
      expect(localStorage.getItem('study-dashboard-v2')).toBe('{"tasks":[]}')
    })

    it('8, 9. cleanup failure after commit preserves imported data/marker and returns distinct warning', async () => {
      localStorage.setItem('study-dashboard-v2', '{"tasks":[]}')
      const result = await importStudyData(validV3Payload, { forceCleanupError: true })
      expect(result).toEqual({ warning: 'cleanup_failed' })
      expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
      expect(await studyDb.tasks.toArray()).toMatchObject([{ id: 'task-imported' }])
    })

    it('10. startup migration after cleanup failure does not re-import stale legacy data', async () => {
      localStorage.setItem('study-dashboard-v2', JSON.stringify({
        tasks: [{ id: 'task-legacy', title: 'Stale task', done: false, minutes: 30 }],
      }))

      // Force import cleanup failure -> DB has marker true, localStorage has legacy key
      const result = await importStudyData(validV3Payload, { forceCleanupError: true })
      expect(result.warning).toBe('cleanup_failed')

      // Now invoke startup migration
      const migrationResult = await migrateLegacyLocalStorage()
      expect(migrationResult.status).toBe('already_migrated')

      // DB still contains imported task, not stale legacy task
      expect(await studyDb.tasks.toArray()).toMatchObject([{ id: 'task-imported' }])
    })

    it('11. portable settings omitted from backup are deleted', async () => {
      await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 120 })
      await studyDb.settings.put({ key: 'quickNotes', value: ['old note'] })

      const emptySettingsPayload = {
        ...validV3Payload,
        settings: [],
      }

      await importStudyData(emptySettingsPayload)
      expect(await studyDb.settings.get('dailyGoalMinutes')).toBeUndefined()
      expect(await studyDb.settings.get('quickNotes')).toBeUndefined()
      expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
    })

    it('12. portable settings present in backup are restored', async () => {
      await importStudyData(validV3Payload)
      expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(300)
    })

    it('13. old device portable settings are not accidentally retained', async () => {
      await studyDb.settings.put({ key: 'customDeviceSetting', value: 'oldValue' })
      await importStudyData(validV3Payload)
      expect(await studyDb.settings.get('customDeviceSetting')).toBeUndefined()
    })

    it('14. entity tables are fully replaced, not merged', async () => {
      await studyDb.tasks.add({
        id: 'task-old',
        title: 'Old task',
        subjectId: '',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: 30,
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      await importStudyData(validV3Payload)
      const tasks = await studyDb.tasks.toArray()
      expect(tasks).toHaveLength(1)
      expect(tasks[0]?.id).toBe('task-imported')
    })

    it('15, 16, 17. transaction failure rolls back all clears and restores preserving pre-import snapshot', async () => {
      // Seed pre-import state
      await studyDb.tasks.add({
        id: 'task-pre',
        title: 'Pre task',
        subjectId: '',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: 30,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 180 })

      const snapshotBefore = await getStudyData()

      await expect(importStudyData(validV3Payload, { forceQuotaError: true })).rejects.toThrow()
      const snapshotAfterQuota = await getStudyData()
      expect(snapshotAfterQuota).toEqual(snapshotBefore)

      await expect(importStudyData(validV3Payload, { abortTransaction: true })).rejects.toThrow()
      const snapshotAfterAbort = await getStudyData()
      expect(snapshotAfterAbort).toEqual(snapshotBefore)
    })

    it('21. new exports omit legacy migration marker while maintaining v1-v3 import compatibility', async () => {
      await studyDb.settings.put({ key: 'legacy-localstorage-migrated-v1', value: true })
      await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 240 })

      const exported = await exportStudyData()
      expect(exported.settings.find((s) => s.key === 'legacy-localstorage-migrated-v1')).toBeUndefined()
      expect(exported.settings.find((s) => s.key === 'dailyGoalMinutes')).toBeDefined()

      // Round-trip export into fresh DB
      await clearAllStudyData()
      await importStudyData(exported)
      expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
    })
  })
})
