import { useMemo } from 'react'
import { useActiveTabSync } from '../lib/activeTabSync'
import { useDashboardData } from '../hooks/useDashboardData'
import { useGamification } from '../hooks/useGamification'
import { useAnalytics } from '../hooks/useAnalytics'
import { useAnalyticsHistoryRange } from '../hooks/useAnalyticsHistoryRange'
import { useJournalCalendar } from '../hooks/useJournalCalendar'

export function useStudyDataState() {
  const data = useDashboardData()
  const { tasks, history, recentHistory, settings, todayLog, flashcards, quickNotes, categories, allLogs, isDataReady } = data
  const activeTab = useActiveTabSync()

  const journalEnabled = activeTab === 'journal' || activeTab === 'analytics'
  const analyticsEnabled = activeTab === 'analytics'

  const analyticsRange = useAnalyticsHistoryRange(analyticsEnabled)

  const { currentStreak, xpData, pendingLevelUp, dismissLevelUp } = useGamification({
    allLogs: allLogs.allLogs,
    isDataReady,
  })

  const { insights, breakdownData } = useAnalytics({
    enabled: analyticsEnabled,
    sessionHistory: analyticsRange.history,
    sessionTasks: tasks.tasks,
    allLogs: allLogs.allLogs,
    categories: categories.categories,
  })

  const journal = useJournalCalendar({
    enabled: journalEnabled,
    sessionTasks: tasks.tasks,
    dailyGoalMinutes: settings.dailyGoalMinutes,
    studyBlockDurationMinutes: settings.studyBlockDurationMinutes,
    todayStudyMinutes: todayLog.studyMinutes,
    todayBreakMinutes: todayLog.breakMinutes,
  })

  const progress = useMemo(
    () => (settings.dailyGoalMinutes > 0 ? Math.min(todayLog.studyMinutes / settings.dailyGoalMinutes, 1) : 0),
    [settings.dailyGoalMinutes, todayLog.studyMinutes],
  )

  return useMemo(() => ({
    isDataReady,
    tasks,
    history,
    recentHistory,
    settings,
    todayLog,
    flashcards,
    quickNotes,
    categories,
    allLogs,
    currentStreak,
    xpData,
    pendingLevelUp,
    dismissLevelUp,
    insights,
    breakdownData,
    analyticsRange,
    journal,
    progress,
  }), [
    isDataReady,
    tasks,
    history,
    recentHistory,
    settings,
    todayLog,
    flashcards,
    quickNotes,
    categories,
    allLogs,
    currentStreak,
    xpData,
    pendingLevelUp,
    dismissLevelUp,
    insights,
    breakdownData,
    analyticsRange,
    journal,
    progress,
  ])
}
