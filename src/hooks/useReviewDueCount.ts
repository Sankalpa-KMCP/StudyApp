import { useMemo } from 'react'
import type { TaskItem } from '../db/types'
import { countReviewDueTasks } from '../lib/study/taskFilters'
import { getTodayDateString } from '../lib/study/dates'

export function useReviewDueCount(tasks: TaskItem[]): number {
  const todayStr = useMemo(() => getTodayDateString(), [])
  return useMemo(() => countReviewDueTasks(tasks, todayStr), [tasks, todayStr])
}
