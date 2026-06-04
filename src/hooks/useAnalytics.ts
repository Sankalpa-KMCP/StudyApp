import { useMemo } from 'react'
import {
  calculateProductivityInsights,
  calculateCategoryBreakdown,
} from '../lib/studyDashboard'
import type { CategoryItem, DailyLog, HistoryEntry, TaskItem } from '../db/types'

interface UseAnalyticsOptions {
  sessionHistory: HistoryEntry[]
  sessionTasks: TaskItem[]
  allLogs: DailyLog[]
  categories: CategoryItem[]
}

export function useAnalytics({
  sessionHistory,
  sessionTasks,
  allLogs,
  categories,
}: UseAnalyticsOptions) {
  const insights = useMemo(
    () => calculateProductivityInsights(sessionHistory, sessionTasks, allLogs, categories),
    [sessionHistory, sessionTasks, allLogs, categories],
  )

  const breakdownData = useMemo(
    () => calculateCategoryBreakdown(sessionHistory, categories),
    [sessionHistory, categories],
  )

  return { insights, breakdownData }
}
