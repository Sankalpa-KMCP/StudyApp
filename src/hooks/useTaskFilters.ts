import { useMemo } from 'react'
import type { CategoryItem, TaskItem } from '../db/types'
import { isInReviewQueue } from '../lib/study/taskFilters'
import { getTodayDateString } from '../lib/study/dates'

export function useTodayDateString() {
  return useMemo(() => getTodayDateString(), [])
}

export function useTaskFilters(tasks: TaskItem[], categories: CategoryItem[], todayStr: string) {
  const categoriesMap = useMemo(() => {
    const m = new Map<number, CategoryItem>()
    categories.forEach(c => {
      if (c.id !== undefined) m.set(c.id, c)
    })
    return m
  }, [categories])

  const activeTasksList = useMemo(() => tasks.filter(t => !t.completed && !t.archived), [tasks])

  const reviewQueueList = useMemo(
    () => tasks.filter(t => isInReviewQueue(t, todayStr)),
    [tasks, todayStr],
  )

  const completedTasksList = useMemo(
    () =>
      tasks
        .filter(t => t.completed && !t.archived && !isInReviewQueue(t, todayStr))
        .sort((a, b) => b.createdAt - a.createdAt),
    [tasks, todayStr],
  )

  return { categoriesMap, activeTasksList, reviewQueueList, completedTasksList }
}
