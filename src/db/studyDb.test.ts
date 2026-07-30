import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllStudyData, exportStudyData, getStudyData, importStudyData, migrateLegacyLocalStorage, nowIso, studyDb } from './studyDb'

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
