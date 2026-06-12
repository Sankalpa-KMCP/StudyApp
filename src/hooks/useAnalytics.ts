import { useMemo } from 'react'
import {
  calculateProductivityInsights,
  calculateCategoryBreakdown,
} from '../lib/study/studyDashboard'
import type { CategoryItem, DailyLog, HistoryEntry, TaskItem } from '../db/types'

const EMPTY_INSIGHTS = {
  topSubject: 'None yet',
  avgMin: 0,
  completionRate: 0,
  peakDay: 'No data',
}

interface UseAnalyticsOptions {
  enabled?: boolean
  sessionHistory: HistoryEntry[]
  sessionTasks: TaskItem[]
  allLogs: DailyLog[]
  categories: CategoryItem[]
}

export function useAnalytics({
  enabled = true,
  sessionHistory,
  sessionTasks,
  allLogs,
  categories,
}: UseAnalyticsOptions) {
  const insights = useMemo(
    () => (enabled
      ? calculateProductivityInsights(sessionHistory, sessionTasks, allLogs, categories)
      : EMPTY_INSIGHTS),
    [enabled, sessionHistory, sessionTasks, allLogs, categories],
  )

  const breakdownData = useMemo(
    () => (enabled ? calculateCategoryBreakdown(sessionHistory, categories) : { breakdown: [] }),
    [enabled, sessionHistory, categories],
  )

  return { insights, breakdownData }
}
