import { db } from '../db'
import type { TaskItem } from '../types'

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
