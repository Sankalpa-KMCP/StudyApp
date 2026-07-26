import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listTasks } from './taskRead'
import { studyDb } from './studyDb'

describe('taskRead', () => {
  beforeEach(async () => {
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('returns an empty array when no tasks exist', async () => {
    expect(await listTasks()).toEqual([])
  })

  it('returns tasks ordered by createdAt ascending like getStudyData', async () => {
    await studyDb.tasks.bulkAdd([
      {
        id: 'task-later',
        title: 'Later',
        subjectId: '',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: 20,
        createdAt: '2026-07-03T12:00:00.000Z',
        updatedAt: '2026-07-03T12:00:00.000Z',
      },
      {
        id: 'task-earliest',
        title: 'Earliest',
        subjectId: '',
        dueDate: '2026-07-10',
        priority: 'high',
        status: 'open',
        minutes: 30,
        createdAt: '2026-07-01T09:00:00.000Z',
        updatedAt: '2026-07-01T09:00:00.000Z',
      },
      {
        id: 'task-middle',
        title: 'Middle',
        subjectId: '',
        dueDate: '',
        priority: 'low',
        status: 'done',
        minutes: 15,
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T00:00:00.000Z',
      },
    ])

    const tasks = await listTasks()
    expect(tasks.map((task) => task.id)).toEqual(['task-earliest', 'task-middle', 'task-later'])
  })

  it('keeps equal createdAt rows adjacent and stable relative to insert order under Dexie ordering', async () => {
    const sharedCreated = '2026-07-02T10:00:00.000Z'
    await studyDb.tasks.bulkAdd([
      {
        id: 'task-tie-a',
        title: 'Tie A',
        subjectId: '',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: 10,
        createdAt: sharedCreated,
        updatedAt: sharedCreated,
      },
      {
        id: 'task-tie-b',
        title: 'Tie B',
        subjectId: '',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: 10,
        createdAt: sharedCreated,
        updatedAt: sharedCreated,
      },
      {
        id: 'task-after',
        title: 'After',
        subjectId: '',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        minutes: 10,
        createdAt: '2026-07-02T11:00:00.000Z',
        updatedAt: '2026-07-02T11:00:00.000Z',
      },
    ])

    const tasks = await listTasks()
    expect(tasks.map((task) => task.id)).toEqual(['task-tie-a', 'task-tie-b', 'task-after'])
    expect(tasks[0]?.createdAt).toBe(sharedCreated)
    expect(tasks[1]?.createdAt).toBe(sharedCreated)
  })
})
