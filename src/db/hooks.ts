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

import type { CategoryItem, HistoryEntry } from './types'
import {
  calculateCalendarHeatmapData as calculateCalendarHeatmapDataPure,
  calculateCategoryBreakdown as calculateCategoryBreakdownPure,
  calculateMonthLogs as calculateMonthLogsPure,
  calculateProductivityInsights as calculateProductivityInsightsPure,
  calculateSM2 as calculateSM2Pure,
  calculateStreak as calculateStreakPure,
  calculateXpLevel as calculateXpLevelPure,
} from '../lib/studyDashboard'

export function calculateStreak(allLogs: { dateString: string; studyMinutes: number }[]) {
  return calculateStreakPure(allLogs)
}

export function calculateXpLevel(allLogs: { dateString: string; studyMinutes: number }[]) {
  return calculateXpLevelPure(allLogs)
}

export function calculateProductivityInsights(allHistory: HistoryEntry[], allTasks: { completed: boolean }[], allLogs: { dateString: string; studyMinutes: number }[], categories: CategoryItem[]) {
  return calculateProductivityInsightsPure(allHistory, allTasks, allLogs, categories)
}

export function calculateCategoryBreakdown(allHistory: HistoryEntry[], categories: CategoryItem[]) {
  return calculateCategoryBreakdownPure(allHistory, categories)
}

export function calculateMonthLogs<T extends { dateString: string; studyMinutes: number }>(allLogs: T[], month: number, year: number, studyBlockMinutes = 25) {
  return calculateMonthLogsPure(allLogs, month, year, studyBlockMinutes)
}

export function calculateCalendarHeatmapData(allHistory: HistoryEntry[], month: number, year: number, filterCategoryId: number | 'all') {
  return calculateCalendarHeatmapDataPure(allHistory, month, year, filterCategoryId)
}

export function calculateSM2(q: number, prevRep: number = 0, prevEF: number = 2.5, prevInterval: number = 0) {
  return calculateSM2Pure(q, prevRep, prevEF, prevInterval)
}
