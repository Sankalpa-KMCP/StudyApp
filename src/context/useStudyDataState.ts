import { useMemo } from 'react'
import type { ActiveTab } from '../types/app'
import { useDashboardData } from '../hooks/useDashboardData'
import { useGamification } from '../hooks/useGamification'
import { useLazyStudyFeatures } from '../hooks/useLazyStudyFeatures'

export function useStudyDataState(activeTab: ActiveTab) {
  const data = useDashboardData()
  const { tasks, history, recentHistory, settings, todayLog, flashcards, quickNotes, categories, allLogs, isDataReady } = data

  const { currentStreak, xpData, pendingLevelUp, dismissLevelUp } = useGamification({
    allLogs: allLogs.allLogs,
    isDataReady,
  })

  const { insights, breakdownData, analyticsRange, journal } = useLazyStudyFeatures({
    activeTab,
    sessionTasks: tasks.tasks,
    dailyGoalMinutes: settings.dailyGoalMinutes,
    studyBlockDurationMinutes: settings.studyBlockDurationMinutes,
    todayStudyMinutes: todayLog.studyMinutes,
    todayBreakMinutes: todayLog.breakMinutes,
    allLogs: allLogs.allLogs,
    categories: categories.categories,
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
