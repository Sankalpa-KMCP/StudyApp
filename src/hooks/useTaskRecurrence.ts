import type { TaskItem } from '../db/types'
import { addTask, updateTaskAfterRecurrenceSpawn } from '../db/repositories/tasks'
import { getNextRecurrenceDate } from '../lib/study/recurrence'

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
