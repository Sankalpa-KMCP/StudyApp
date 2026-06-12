import { db } from '../db'
import type { SubTask, TaskItem } from '../types'

export async function getTask(id: number): Promise<TaskItem | undefined> {
  return db.tasks.get(id)
}

export async function getAllTasks(): Promise<TaskItem[]> {
  return db.tasks.toArray()
}

export async function updateTask(id: number, updates: Partial<TaskItem>): Promise<void> {
  await db.tasks.update(id, updates)
}

export async function updateSubtasks(id: number, subtasks: SubTask[]): Promise<void> {
  await db.tasks.update(id, { subtasks })
}

export async function archiveTasks(ids: number[]): Promise<void> {
  if (ids.length === 0) return
  await Promise.all(ids.map(id => db.tasks.update(id, { archived: true })))
}

export async function updateLastCompleted(id: number): Promise<void> {
  await db.tasks.update(id, { lastCompletedAt: Date.now() })
}

export async function uncompleteTask(id: number): Promise<void> {
  await db.tasks.update(id, { completed: false, nextReviewDate: undefined })
}

export async function incrementActualCycles(id: number, estimatedCycles: number): Promise<{ completed: boolean }> {
  const task = await db.tasks.get(id)
  if (!task) return { completed: false }
  const newActual = (task.actualCycles ?? 0) + 1
  const completed = newActual >= (estimatedCycles ?? 1)
  await db.tasks.update(id, { actualCycles: newActual, completed })
  return { completed }
}

export async function updateTaskAfterRecurrenceSpawn(
  id: number,
  fields: Pick<TaskItem, 'recurrenceRule' | 'recurrenceParentId' | 'studyBlockDurationMinutes' | 'shortBreakDurationMinutes' | 'longBreakDurationMinutes' | 'createdAt'>,
): Promise<void> {
  await db.tasks.update(id, {
    ...fields,
    completed: false,
    actualCycles: 0,
  })
}

export async function addTask(
  text: string,
  categoryId?: number,
  estimatedCycles = 1,
  priority?: 'low' | 'medium' | 'high',
  isStudySubject?: boolean,
): Promise<number> {
  return db.tasks.add({
    text,
    completed: false,
    createdAt: Date.now(),
    categoryId,
    estimatedCycles,
    actualCycles: 0,
    priority,
    isStudySubject,
  })
}

export async function toggleTask(id: number) {
  const task = await db.tasks.get(id)
  if (task) {
    await db.tasks.update(id, { completed: !task.completed })
  }
}

export async function incrementTaskCycle(id: number) {
  const task = await db.tasks.get(id)
  if (task) {
    const legacyTask = task as TaskItem & { actualPomodoros?: number }
    const currentActual = task.actualCycles ?? legacyTask.actualPomodoros ?? 0
    await db.tasks.update(id, { actualCycles: currentActual + 1 })
  }
}
