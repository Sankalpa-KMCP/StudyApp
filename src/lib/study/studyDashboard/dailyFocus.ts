import type { CategoryItem, HistoryEntry } from '../../../db/types'
import { buildDateString, formatMinutes } from './dateTime'

export interface DailyFocusStatus {
  percent: number
  goalMet: boolean
  studiedLabel: string
  remainingMinutes: number
  remainingLabel: string
}

export function getEffectiveDailyGoal(category: CategoryItem | undefined, globalGoalMinutes: number): number {
  if (category?.dailyGoalMinutes !== undefined && category.dailyGoalMinutes > 0) {
    return category.dailyGoalMinutes
  }
  return globalGoalMinutes
}

export function getTodayCategoryStudyMinutes(history: HistoryEntry[], categoryId: number, todayStr = buildDateString()): number {
  return history
    .filter(entry => entry.type === 'study' && entry.categoryId === categoryId && entry.timestamp.startsWith(todayStr))
    .reduce((sum, entry) => sum + entry.durationMinutes, 0)
}

export function getDailyFocusStatus(studiedMinutes: number, goalMinutes: number): DailyFocusStatus {
  const studied = Number.isFinite(studiedMinutes) ? Math.max(0, Math.floor(studiedMinutes)) : 0
  const goal = Number.isFinite(goalMinutes) ? Math.max(0, Math.floor(goalMinutes)) : 0
  const goalMet = goal > 0 && studied >= goal
  const percent = goal > 0 ? Math.min(studied / goal, 1) : 0
  const remainingMinutes = goal > 0 ? Math.max(goal - studied, 0) : 0

  return {
    percent,
    goalMet,
    studiedLabel: formatMinutes(studied),
    remainingMinutes,
    remainingLabel: goalMet ? 'Goal met' : goal > 0 ? `${formatMinutes(remainingMinutes)} left today` : 'No goal set',
  }
}

export function getIntensity(minutes: number): 0 | 1 | 2 | 3 {
  if (!Number.isFinite(minutes) || minutes < 60) return 0
  if (minutes < 120) return 1
  if (minutes < 180) return 2
  return 3
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : null
}
