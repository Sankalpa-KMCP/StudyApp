import Dexie, { type Table } from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearAllStudyData, exportStudyData, getStudyData, importStudyData, migrateLegacyLocalStorage, nowIso, studyDb } from './studyDb'
import type { StudyGoal } from './types'

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

describe('studyDb', () => {
  beforeEach(async () => {
    localStorage.clear()
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
    expect(snapshot.version).toBe(2)
    expect(restored.goals[0]?.metric).toBe('study_time')
  })

  it('exports version 2 with explicit goal metrics and round-trips them', async () => {
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

    const snapshot = await exportStudyData()
    expect(snapshot.version).toBe(2)
    expect(snapshot.goals.every((goal) => goal.metric === 'manual' || goal.metric === 'study_time')).toBe(true)

    await clearAllStudyData()
    await importStudyData(snapshot)

    const restored = await studyDb.goals.toArray()
    const byId = new Map(restored.map((goal) => [goal.id, goal]))
    expect(byId.get('goal-manual-export')?.metric).toBe('manual')
    expect(byId.get('goal-study-export')?.metric).toBe('study_time')
    expect(byId.get('goal-manual-export')?.title).toBe('Daily focus')
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

    await expect(importStudyData({ ...validV2, version: 3 })).rejects.toThrow('Import file is not a Study Dashboard export.')
    expect(await studyDb.subjects.get('subject-seeded')).toMatchObject({ name: 'Seeded subject' })
    expect((await studyDb.settings.get('activeFocusSession'))?.value).toMatchObject({ id: 'focus-imported' })
  })

  it('rejects malformed records without replacing existing data', async () => {
    const timestamp = nowIso()
    await studyDb.subjects.add({
      id: 'subject-existing',
      name: 'Existing subject',
      color: '#111827',
      targetHours: 5,
      progress: 10,
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
    expect(studyDb.verno).toBe(2)

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
