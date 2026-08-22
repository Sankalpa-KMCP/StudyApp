import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTask, deleteTask, setTaskStatus, updateTask } from './taskService'
import { SubjectNotFoundError } from './subjectValidation'
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

  it('creates an open task with generated id and matching timestamps for existing subject', async () => {
    await studyDb.subjects.add({
      id: 'subject-math',
      name: 'Mathematics',
      color: '#3b82f6',
      targetHours: 10,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

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

  it('creates an open task with general subjectId: ""', async () => {
    const created = await createTask({
      title: 'General task',
      subjectId: '',
      dueDate: '2026-07-22',
      priority: 'normal',
      minutes: 30,
    })

    expect(created.subjectId).toBe('')
    expect(await studyDb.tasks.get(created.id)).toEqual(created)
  })

  it('rejects createTask when subjectId does not exist and leaves tasks store empty', async () => {
    let thrownError: unknown = null
    try {
      await createTask({
        title: 'Orphan task',
        subjectId: 'subject-nonexistent',
        dueDate: '2026-07-22',
        priority: 'high',
        minutes: 45,
      })
    } catch (err) {
      thrownError = err
    }

    expect(thrownError).toBeInstanceOf(SubjectNotFoundError)
    expect((thrownError as SubjectNotFoundError).code).toBe('subject_not_found')
    expect((thrownError as SubjectNotFoundError).subjectId).toBe('subject-nonexistent')
    expect(await studyDb.tasks.count()).toBe(0)
  })

  it('updates editable fields and refreshes updatedAt while preserving status and createdAt', async () => {
    await studyDb.subjects.add({
      id: 'subject-chem',
      name: 'Chemistry',
      color: '#10b981',
      targetHours: 8,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

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

  it('rejects updateTask when assigning a nonexistent subjectId and preserves original task', async () => {
    const original = await createTask({
      title: 'Preserve me',
      subjectId: '',
      dueDate: '2026-07-01',
      priority: 'normal',
      minutes: 30,
    })

    let thrownError: unknown = null
    try {
      await updateTask(original.id, {
        title: 'Attempted rename',
        subjectId: 'subject-ghost',
        dueDate: '2026-07-10',
        priority: 'high',
        minutes: 60,
      })
    } catch (err) {
      thrownError = err
    }

    expect(thrownError).toBeInstanceOf(SubjectNotFoundError)
    expect((thrownError as SubjectNotFoundError).subjectId).toBe('subject-ghost')

    const stored = await studyDb.tasks.get(original.id)
    expect(stored).toEqual(original)
  })

  it('throws when updating a missing task with valid subject', async () => {
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
