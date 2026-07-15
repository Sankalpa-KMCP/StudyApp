import { useMemo } from 'react'
import type { TaskItem } from '../db/types'
import { countReviewDueTasks, useTodayDateString } from '../components/task-registry/useTaskFilters'

export function useReviewDueCount(tasks: TaskItem[]): number {
  const todayStr = useTodayDateString()
  return useMemo(() => countReviewDueTasks(tasks, todayStr), [tasks, todayStr])
}
