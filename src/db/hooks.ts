/**
 * Stable barrel for Dexie data hooks consumed by useDashboardData and useJournalCalendar.
 * Import from here rather than queries.ts directly so hook locations can evolve.
 */
export { useTasks } from './hooks/useTasks'
export { useCategories } from './hooks/useCategories'
export { useHistory, useHistoryMutations, useRecentHistory, useHistoryForMonth } from './hooks/useHistory'
export { useSettings } from './hooks/useSettings'
export { useTodayLog } from './hooks/useTodayLog'
export { updateDailyReflection } from './repositories/dailyLogs'
export { useAllDailyLogs } from './hooks/useAllDailyLogs'
export { useStudyMinuteSummaries } from './hooks/useStudyMinuteSummaries'
export { useMonthLogsQuery } from './hooks/useMonthLogsQuery'
export { useFlashcards } from './hooks/useFlashcards'
export { useQuickNotes } from './hooks/useQuickNotes'
