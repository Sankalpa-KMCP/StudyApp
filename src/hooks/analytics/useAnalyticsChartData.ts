import { useMemo } from 'react'
import type { DailyLog, TaskItem } from '../../db/types'
import type { ThemeProfile } from '../../types/app'
import {
  buildEstimationInsight,
  buildHeatmapData,
  buildMoodDistribution,
  buildRetentionData,
} from '../../lib/study/analyticsChartData'

export function useRetentionData(tasks: TaskItem[]) {
  return useMemo(() => buildRetentionData(tasks), [tasks])
}

export function useHeatmapData(allLogs: DailyLog[]) {
  return useMemo(() => buildHeatmapData(allLogs), [allLogs])
}

export function useEstimationInsight(tasks: TaskItem[]) {
  return useMemo(() => buildEstimationInsight(tasks), [tasks])
}

export function useMoodDistribution(monthLogs: DailyLog[], activeThemeVars: ThemeProfile) {
  return useMemo(() => buildMoodDistribution(monthLogs, activeThemeVars), [monthLogs, activeThemeVars])
}
