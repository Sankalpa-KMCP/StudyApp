import type { GoalMetric, GoalPeriod } from './types'

/**
 * Reproduces the pre-metric title-based derived-goal rules for migration / v1 import only.
 * Daily + title contains `focus` → study_time; weekly + `study` or `focus` → study_time; else manual.
 */
export function inferLegacyGoalMetric(period: GoalPeriod, title: string): GoalMetric {
  const normalized = title.toLowerCase()
  if (period === 'daily' && normalized.includes('focus')) return 'study_time'
  if (period === 'weekly' && (normalized.includes('study') || normalized.includes('focus'))) return 'study_time'
  return 'manual'
}
