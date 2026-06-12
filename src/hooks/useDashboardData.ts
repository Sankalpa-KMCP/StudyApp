import {
  useTasks,
  useHistoryMutations,
  useRecentHistory,
  useSettings,
  useTodayLog,
  useCategories,
  useAllDailyLogs,
  useFlashcards,
  useQuickNotes,
} from '../db/hooks'

export function useDashboardData() {
  const tasks = useTasks()
  const settings = useSettings()
  const history = useHistoryMutations()
  const recentHistory = useRecentHistory(settings.recentHistoryLimit)
  const todayLog = useTodayLog()
  const flashcardsEnabled = !settings.isLoading && settings.flashcardsEnabled
  const flashcards = useFlashcards(flashcardsEnabled)
  const quickNotes = useQuickNotes()
  const categories = useCategories()
  const allLogs = useAllDailyLogs()

  const isDataReady = !(
    tasks.isLoading
    || recentHistory.isLoading
    || settings.isLoading
    || todayLog.isLoading
    || allLogs.isLoading
    || categories.isLoading
    || flashcards.isLoading
    || quickNotes.isLoading
  )

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
    isDataReady,
  }
}
