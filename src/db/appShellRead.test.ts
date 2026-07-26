import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getAppShellData } from './appShellRead'
import { studyDb } from './studyDb'

describe('appShellRead', () => {
  beforeEach(async () => {
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('reads only subjects and settings without goals, notes, events, flashcards, tasks, or sessions', async () => {
    await studyDb.tasks.add({
      id: 'task-1',
      title: 'Hidden task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })
    await studyDb.subjects.add({
      id: 'subject-1',
      name: 'Visible subject',
      color: '#2563eb',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })
    await studyDb.studySessions.add({
      id: 'session-1',
      subjectId: '',
      startedAt: '2026-07-01T10:00:00.000Z',
      endedAt: '2026-07-01T10:30:00.000Z',
      minutes: 30,
      note: 'Hidden session',
    })
    await studyDb.goals.add({
      id: 'goal-1',
      title: 'Hidden from shell',
      target: 40,
      progress: 0,
      period: 'daily',
      metric: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })
    await studyDb.notes.add({
      id: 'note-1',
      title: 'Also hidden from shell',
      body: 'body',
      subjectId: '',
      tags: [],
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })
    await studyDb.events.add({
      id: 'event-1',
      title: 'Hidden event',
      subjectId: '',
      startAt: '2026-07-02T10:00:00.000Z',
      endAt: '2026-07-02T11:00:00.000Z',
      location: '',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })
    await studyDb.flashcards.add({
      id: 'card-1',
      front: 'Hidden card',
      back: 'answer',
      subjectId: '',
      status: 'new',
      lastReviewedAt: '',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 120 })

    const shell = await getAppShellData()
    expect(shell.subjects).toHaveLength(1)
    expect(shell.settings).toEqual([{ key: 'dailyGoalMinutes', value: 120 }])
    expect(shell).not.toHaveProperty('goals')
    expect(shell).not.toHaveProperty('notes')
    expect(shell).not.toHaveProperty('events')
    expect(shell).not.toHaveProperty('flashcards')
    expect(shell).not.toHaveProperty('tasks')
    expect(shell).not.toHaveProperty('studySessions')
    expect(await studyDb.goals.count()).toBe(1)
    expect(await studyDb.notes.count()).toBe(1)
    expect(await studyDb.events.count()).toBe(1)
    expect(await studyDb.flashcards.count()).toBe(1)
    expect(await studyDb.tasks.count()).toBe(1)
    expect(await studyDb.studySessions.count()).toBe(1)
  })
})
