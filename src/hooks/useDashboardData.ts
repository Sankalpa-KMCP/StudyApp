import type { ActiveTab } from '../types/app'
import {
  useTasks,
  useHistoryMutations,
  useRecentHistory,
  useSettings,
  useTodayLog,
  useCategories,
  useAllDailyLogs,
  useStudyMinuteSummaries,
  useFlashcards,
  useQuickNotes,
} from '../db/hooks'

interface UseDashboardDataOptions {
  activeTab: ActiveTab
  notesEnabled?: boolean
  fullLogsEnabled?: boolean
}

export function useDashboardData({
  activeTab,
  notesEnabled = false,
  fullLogsEnabled,
}: UseDashboardDataOptions) {
  const tasks = useTasks()
  const settings = useSettings()
  const history = useHistoryMutations()
  const recentHistory = useRecentHistory(settings.recentHistoryLimit)
  const todayLog = useTodayLog()
  const categories = useCategories()
  const studySummaries = useStudyMinuteSummaries()

  const flashcardsEnabled = !settings.isLoading && settings.flashcardsEnabled
  const flashcards = useFlashcards(flashcardsEnabled)
  const quickNotes = useQuickNotes(notesEnabled)

  const logsEnabled = fullLogsEnabled || activeTab === 'analytics' || activeTab === 'journal'
  const allLogs = useAllDailyLogs(logsEnabled)

  const isCoreDataReady = !(
    tasks.isLoading
    || recentHistory.isLoading
    || settings.isLoading
    || todayLog.isLoading
    || categories.isLoading
    || studySummaries.isLoading
  )

  const isDataReady = isCoreDataReady

  return {
    tasks,
    history,
    recentHistory,
    settings,
    todayLog,
    flashcards,
    quickNotes,
    categories,
    allLogs,
    studySummaries,
    isDataReady,
    isCoreDataReady,
    logsEnabled,
  }
}
