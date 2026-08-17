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

  it('reads shell tables without including goals or notes', async () => {
    await studyDb.tasks.add({
      id: 'task-1',
      title: 'Task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
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
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 120 })

    const shell = await getAppShellData()
    expect(shell.tasks).toHaveLength(1)
    expect(shell.settings).toEqual([{ key: 'dailyGoalMinutes', value: 120 }])
    expect(shell).not.toHaveProperty('goals')
    expect(shell).not.toHaveProperty('notes')
    expect(await studyDb.goals.count()).toBe(1)
    expect(await studyDb.notes.count()).toBe(1)
  })
})
