import {
  useTasks,
  useHistory,
  useSettings,
  useTodayLog,
  useCategories,
  useAllDailyLogs,
  useFlashcards,
  useQuickNotes,
} from '../db/hooks'

export function useDashboardData() {
  const tasks = useTasks()
  const history = useHistory()
  const settings = useSettings()
  const todayLog = useTodayLog()
  const flashcards = useFlashcards()
  const quickNotes = useQuickNotes()
  const categories = useCategories()
  const allLogs = useAllDailyLogs()

  const isDataReady = !(
    tasks.isLoading
    || history.isLoading
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
    settings,
    todayLog,
    flashcards,
    quickNotes,
    categories,
    allLogs,
    isDataReady,
  }
}
