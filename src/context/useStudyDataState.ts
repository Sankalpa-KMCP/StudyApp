import { useMemo } from 'react'
import type { ActiveTab } from '../types/app'
import { useDashboardData } from '../hooks/useDashboardData'
import { useGamification } from '../hooks/useGamification'
import { useLazyStudyFeatures } from '../hooks/useLazyStudyFeatures'

interface StudyDataStateOptions {
  notesEnabled?: boolean
  fullLogsEnabled?: boolean
}

export function useStudyDataState(
  activeTab: ActiveTab,
  { notesEnabled = false, fullLogsEnabled = false }: StudyDataStateOptions = {},
) {
  const data = useDashboardData({ activeTab, notesEnabled, fullLogsEnabled })
  const {
    tasks, history, recentHistory, settings, todayLog, flashcards, quickNotes,
    categories, allLogs, studySummaries, isDataReady,
  } = data

  const gamificationLogs = allLogs.allLogs.length > 0 ? allLogs.allLogs : studySummaries.summaries

  const { currentStreak, xpData, pendingLevelUp, dismissLevelUp } = useGamification({
    allLogs: gamificationLogs,
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
