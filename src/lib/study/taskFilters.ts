import type { TaskItem } from '../../db/types'

export function isInReviewQueue(task: TaskItem, todayStr: string): boolean {
  return task.completed && !!task.isStudySubject && (!task.nextReviewDate || task.nextReviewDate <= todayStr)
}

export function countReviewDueTasks(tasks: TaskItem[], todayStr: string): number {
  return tasks.filter(t => isInReviewQueue(t, todayStr)).length
}
