import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { resetDatabase } from '../../test/dbTestUtils'
import { addTask, toggleTask, incrementTaskCycle } from '../repositories/tasks'

describe('tasks repository', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('addTask creates an incomplete task and returns the new id', async () => {
    const id = await addTask('Read chapter 3', undefined, 2, 'high', true)
    const tasks = await db.tasks.toArray()
    expect(tasks).toHaveLength(1)
    expect(id).toBe(tasks[0].id)
    expect(tasks[0].text).toBe('Read chapter 3')
    expect(tasks[0].completed).toBe(false)
    expect(tasks[0].estimatedCycles).toBe(2)
    expect(tasks[0].priority).toBe('high')
    expect(tasks[0].isStudySubject).toBe(true)
  })

  it('toggleTask flips completed state', async () => {
    const id = await db.tasks.add({
      text: 'Task',
      completed: false,
      createdAt: Date.now(),
      estimatedCycles: 1,
      actualCycles: 0,
    })
    await toggleTask(id)
    expect((await db.tasks.get(id))?.completed).toBe(true)
    await toggleTask(id)
    expect((await db.tasks.get(id))?.completed).toBe(false)
  })

  it('incrementTaskCycle bumps actualCycles', async () => {
    const id = await db.tasks.add({
      text: 'Task',
      completed: false,
      createdAt: Date.now(),
      estimatedCycles: 3,
      actualCycles: 1,
    })
    await incrementTaskCycle(id)
    expect((await db.tasks.get(id))?.actualCycles).toBe(2)
  })
})
