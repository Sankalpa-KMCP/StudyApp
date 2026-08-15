import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTask, deleteTask, setTaskStatus, updateTask } from './taskService'
import { studyDb } from './studyDb'

describe('taskService', () => {
  beforeEach(async () => {
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('creates an open task with generated id and matching timestamps', async () => {
    const created = await createTask({
      title: 'Linear algebra drills',
      subjectId: 'subject-math',
      dueDate: '2026-07-22',
      priority: 'high',
      minutes: 45,
    })

    expect(created.id).toMatch(/^task-/)
    expect(created).toMatchObject({
      title: 'Linear algebra drills',
      subjectId: 'subject-math',
      dueDate: '2026-07-22',
      priority: 'high',
      status: 'open',
      minutes: 45,
    })
    expect(created.createdAt).toBe(created.updatedAt)
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false)
    expect(await studyDb.tasks.get(created.id)).toEqual(created)
  })

  it('updates editable fields and refreshes updatedAt while preserving status and createdAt', async () => {
    const original = await createTask({
      title: 'Original',
      subjectId: '',
      dueDate: '2026-07-01',
      priority: 'normal',
      minutes: 30,
    })

    await updateTask(original.id, {
      title: 'Renamed',
      subjectId: 'subject-chem',
      dueDate: '2026-07-10',
      priority: 'low',
      minutes: 70,
    })

    const stored = await studyDb.tasks.get(original.id)
    expect(stored).toMatchObject({
      id: original.id,
      title: 'Renamed',
      subjectId: 'subject-chem',
      dueDate: '2026-07-10',
      priority: 'low',
      minutes: 70,
      status: 'open',
      createdAt: original.createdAt,
    })
    expect(Date.parse(stored!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(original.createdAt))
  })

  it('throws when updating a missing task', async () => {
    await expect(updateTask('task-missing', {
      title: 'Gone',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      minutes: 30,
    })).rejects.toThrow('Task no longer exists.')
  })

  it('changes task status and refreshes updatedAt', async () => {
    const original = await createTask({
      title: 'Toggle me',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      minutes: 20,
    })

    await setTaskStatus(original.id, 'done')
    const done = await studyDb.tasks.get(original.id)
    expect(done).toMatchObject({
      id: original.id,
      status: 'done',
      createdAt: original.createdAt,
    })
    expect(Date.parse(done!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(original.createdAt))

    await setTaskStatus(original.id, 'open')
    expect(await studyDb.tasks.get(original.id)).toMatchObject({ status: 'open' })
  })

  it('throws when changing status on a missing task', async () => {
    await expect(setTaskStatus('task-missing', 'done')).rejects.toThrow('Task no longer exists.')
  })

  it('deletes an existing task', async () => {
    const created = await createTask({
      title: 'Temporary',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      minutes: 15,
    })

    await deleteTask(created.id)
    expect(await studyDb.tasks.get(created.id)).toBeUndefined()
  })

  it('treats deleting a missing task as success', async () => {
    await expect(deleteTask('task-already-gone')).resolves.toBeUndefined()
    expect(await studyDb.tasks.count()).toBe(0)
  })
})
