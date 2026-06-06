import { useMemo } from 'react'
import type { CategoryItem, TaskItem } from '../../db/types'
import { buildDateString } from '../../lib/studyDashboard'

export function useTodayDateString() {
  return useMemo(() => buildDateString(new Date()), [])
}

export function useTaskFilters(tasks: TaskItem[], categories: CategoryItem[], todayStr: string) {
  const categoriesMap = useMemo(() => {
    const m = new Map<number, CategoryItem>()
    categories.forEach(c => {
      if (c.id !== undefined) m.set(c.id, c)
    })
    return m
  }, [categories])

  const activeTasksList = useMemo(() => tasks.filter(t => !t.completed), [tasks])

  const reviewQueueList = useMemo(
    () => tasks.filter(t => t.completed && t.isStudySubject && (!t.nextReviewDate || t.nextReviewDate <= todayStr)),
    [tasks, todayStr],
  )

  return { categoriesMap, activeTasksList, reviewQueueList }
}
