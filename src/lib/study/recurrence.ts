import type { TaskItem } from '../../db/types'
import { addTask, updateTaskAfterRecurrenceSpawn } from '../../db/repositories/tasks'

export function getNextRecurrenceDate(rule: TaskItem['recurrenceRule'], from = new Date()): Date | null {
  if (!rule) return null
  const next = new Date(from)
  if (rule === 'daily') {
    next.setDate(next.getDate() + 1)
    return next
  }
  if (rule === 'weekly') {
    next.setDate(next.getDate() + 7)
    return next
  }
  if (rule === 'weekdays') {
    do {
      next.setDate(next.getDate() + 1)
    } while (next.getDay() === 0 || next.getDay() === 6)
    return next
  }
  return null
}

export async function spawnNextRecurrence(completedTask: TaskItem): Promise<number | null> {
  if (!completedTask.recurrenceRule || completedTask.id === undefined) return null
  const nextDate = getNextRecurrenceDate(completedTask.recurrenceRule)
  if (!nextDate) return null

  const id = await addTask(
    completedTask.text,
    completedTask.categoryId,
    completedTask.estimatedCycles,
    completedTask.priority,
    completedTask.isStudySubject,
  )

  await updateTaskAfterRecurrenceSpawn(id, {
    recurrenceRule: completedTask.recurrenceRule,
    recurrenceParentId: completedTask.recurrenceParentId ?? completedTask.id,
    studyBlockDurationMinutes: completedTask.studyBlockDurationMinutes,
    shortBreakDurationMinutes: completedTask.shortBreakDurationMinutes,
    longBreakDurationMinutes: completedTask.longBreakDurationMinutes,
    createdAt: nextDate.getTime(),
  })

  return id
}
