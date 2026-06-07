import { useMemo } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { useGamification } from '../hooks/useGamification'
import { useAnalytics } from '../hooks/useAnalytics'
import { useJournalCalendar } from '../hooks/useJournalCalendar'
import type { useAppToast } from '../hooks/useAppToast'

type PushToast = ReturnType<typeof useAppToast>['pushToast']

export function useStudyDataState(pushToast: PushToast) {
  const data = useDashboardData()
  const { tasks, history, recentHistory, settings, todayLog, flashcards, quickNotes, categories, allLogs, isDataReady } = data

  const { currentStreak, xpData } = useGamification({
    allLogs: allLogs.allLogs,
    isDataReady,
    pushToast,
  })

  const { insights, breakdownData } = useAnalytics({
    sessionHistory: recentHistory.history,
    sessionTasks: tasks.tasks,
    allLogs: allLogs.allLogs,
    categories: categories.categories,
  })

  const journal = useJournalCalendar({
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
    insights,
    breakdownData,
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
    insights,
    breakdownData,
    journal,
    progress,
  ])
}
