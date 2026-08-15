import { createId, nowIso, studyDb } from './studyDb'
import type { StudyTask, TaskPriority, TaskStatus } from './types'

/** Fields the Tasks editor supplies after UI validation and minutes clamping. */
export type TaskWriteFields = {
  title: string
  subjectId: string
  dueDate: string
  priority: TaskPriority
  minutes: number
}

/**
 * Persist a new task as `open`. Owns id and created/updated timestamps.
 */
export async function createTask(fields: TaskWriteFields): Promise<StudyTask> {
  const timestamp = nowIso()
  const task: StudyTask = {
    id: createId('task'),
    title: fields.title,
    subjectId: fields.subjectId,
    dueDate: fields.dueDate,
    priority: fields.priority,
    status: 'open',
    minutes: fields.minutes,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await studyDb.tasks.add(task)
  return task
}

/**
 * Update an existing task's editable fields and refresh `updatedAt`.
 * Throws when no row matches `id`.
 */
export async function updateTask(id: string, fields: TaskWriteFields): Promise<void> {
  const updated = await studyDb.tasks.update(id, {
    title: fields.title,
    subjectId: fields.subjectId,
    dueDate: fields.dueDate,
    priority: fields.priority,
    minutes: fields.minutes,
    updatedAt: nowIso(),
  })
  if (updated === 0) throw new Error('Task no longer exists.')
}

/**
 * Set an existing task's open/done status and refresh `updatedAt`.
 * Throws when no row matches `id`.
 */
export async function setTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const updated = await studyDb.tasks.update(id, {
    status,
    updatedAt: nowIso(),
  })
  if (updated === 0) throw new Error('Task no longer exists.')
}

/**
 * Delete a task by id. Missing rows are not treated as errors (Dexie delete is idempotent).
 */
export async function deleteTask(id: string): Promise<void> {
  await studyDb.tasks.delete(id)
}
