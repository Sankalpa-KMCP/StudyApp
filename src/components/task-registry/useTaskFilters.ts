import { useMemo } from 'react'
import type { CategoryItem, TaskItem } from '../../db/types'
import { buildDateString } from '../../lib/study/studyDashboard'

export function useTodayDateString() {
  return useMemo(() => buildDateString(new Date()), [])
}

function isInReviewQueue(task: TaskItem, todayStr: string) {
  return task.completed && task.isStudySubject && (!task.nextReviewDate || task.nextReviewDate <= todayStr)
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
