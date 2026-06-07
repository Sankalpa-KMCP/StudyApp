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

const RECENT_HISTORY_LIMIT = 100

export function useDashboardData() {
  const tasks = useTasks()
  const history = useHistoryMutations()
  const recentHistory = useRecentHistory(RECENT_HISTORY_LIMIT)
  const settings = useSettings()
  const todayLog = useTodayLog()
  const flashcards = useFlashcards()
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
