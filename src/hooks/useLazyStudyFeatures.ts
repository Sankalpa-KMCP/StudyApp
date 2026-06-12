import { useMemo } from 'react'
import type { ActiveTab } from '../types/app'
import type { CategoryItem, DailyLog, TaskItem } from '../db/types'
import { useAnalytics } from './useAnalytics'
import { useAnalyticsHistoryRange } from './useAnalyticsHistoryRange'
import { useJournalCalendar } from './useJournalCalendar'

interface LazyStudyFeaturesInput {
  activeTab: ActiveTab
  sessionTasks: TaskItem[]
  dailyGoalMinutes: number
  studyBlockDurationMinutes: number
  todayStudyMinutes: number
  todayBreakMinutes: number
  allLogs: DailyLog[]
  categories: CategoryItem[]
}

export function useLazyStudyFeatures({
  activeTab,
  sessionTasks,
  dailyGoalMinutes,
  studyBlockDurationMinutes,
  todayStudyMinutes,
  todayBreakMinutes,
  allLogs,
  categories,
}: LazyStudyFeaturesInput) {
  const journalEnabled = activeTab === 'journal' || activeTab === 'analytics'
  const analyticsEnabled = activeTab === 'analytics'

  const analyticsRange = useAnalyticsHistoryRange(analyticsEnabled)

  const { insights, breakdownData } = useAnalytics({
    enabled: analyticsEnabled,
    sessionHistory: analyticsRange.history,
    sessionTasks,
    allLogs,
    categories,
  })

  const journal = useJournalCalendar({
    enabled: journalEnabled,
    sessionTasks,
    dailyGoalMinutes,
    studyBlockDurationMinutes,
    todayStudyMinutes,
    todayBreakMinutes,
  })

  return useMemo(() => ({
    insights,
    breakdownData,
    analyticsRange,
    journal,
  }), [insights, breakdownData, analyticsRange, journal])
}
