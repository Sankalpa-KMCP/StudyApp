/**
 * Stable barrel for Dexie data hooks consumed by useDashboardData and useJournalCalendar.
 * Import from here rather than queries.ts directly so hook locations can evolve.
 */
export {
  useTasks,
  useCategories,
  useHistory,
  useSettings,
  useTodayLog,
  updateDailyReflection,
  useAllDailyLogs,
  useMonthLogsQuery,
  useFlashcards,
  useQuickNotes,
} from './queries'
