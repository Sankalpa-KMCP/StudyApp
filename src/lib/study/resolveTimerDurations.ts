import type { CategoryItem, TaskItem } from '../../db/types'

export interface TimerDurationGlobals {
  studyBlockDurationMinutes: number
  shortBreakDurationMinutes: number
  longBreakDurationMinutes: number
}

export function resolveTimerDurations(
  globals: TimerDurationGlobals,
  task: TaskItem | null | undefined,
  category: CategoryItem | null | undefined,
): TimerDurationGlobals {
  const fromTask = task
    ? {
        studyBlockDurationMinutes: task.studyBlockDurationMinutes,
        shortBreakDurationMinutes: task.shortBreakDurationMinutes,
        longBreakDurationMinutes: task.longBreakDurationMinutes,
      }
    : {}
  const fromCategory = category
    ? {
        studyBlockDurationMinutes: category.studyBlockDurationMinutes,
        shortBreakDurationMinutes: category.shortBreakDurationMinutes,
        longBreakDurationMinutes: category.longBreakDurationMinutes,
      }
    : {}

  return {
    studyBlockDurationMinutes:
      fromTask.studyBlockDurationMinutes ?? fromCategory.studyBlockDurationMinutes ?? globals.studyBlockDurationMinutes,
    shortBreakDurationMinutes:
      fromTask.shortBreakDurationMinutes ?? fromCategory.shortBreakDurationMinutes ?? globals.shortBreakDurationMinutes,
    longBreakDurationMinutes:
      fromTask.longBreakDurationMinutes ?? fromCategory.longBreakDurationMinutes ?? globals.longBreakDurationMinutes,
  }
}
