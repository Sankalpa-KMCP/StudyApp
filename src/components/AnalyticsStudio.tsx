import React from 'react'
import type { TaskItem, DailyLog, FlashcardItem } from '../db/types'
import type { ThemeProfile } from '../types/app'
import type { CSSProperties } from 'react'
import { SummaryMetricsRow } from './analytics/SummaryMetricsRow'
import { TrendsChartsPanel } from './analytics/TrendsChartsPanel'
import { RetentionChartPanel } from './analytics/RetentionChartPanel'
import { HeatmapPanel } from './analytics/HeatmapPanel'
import { BreakdownPanels } from './analytics/BreakdownPanels'
import {
  useHeatmapData,
  useRetentionData,
  useMoodDistribution,
  useEstimationInsight,
} from './analytics/useAnalyticsChartData'

interface AnalyticsStudioProps {
  tasks: TaskItem[]
  flashcards: FlashcardItem[]
  monthLogs: DailyLog[]
  allLogs: DailyLog[]
  totalMonthHours: number
  totalWeeklyBreakHours: number
  totalDaysInMonth: number
  currentStreak: number
  level: number
  chartData: Array<{ day: string; hours: number; focus: number }>
  categoryBreakdown: Array<{ name: string; color: string; hours: number; percentage: number }>
  topSubject: string
  avgMin: number
  completionRate: number
  peakDay: string
  activeThemeVars: ThemeProfile
  tooltipStyle: CSSProperties
  hasChartData: boolean
}

export const AnalyticsStudio: React.FC<AnalyticsStudioProps> = ({
  tasks,
  flashcards,
  monthLogs,
  allLogs,
  totalMonthHours,
  totalWeeklyBreakHours,
  totalDaysInMonth,
  currentStreak,
  chartData,
  categoryBreakdown,
  topSubject,
  avgMin,
  completionRate,
  peakDay,
  activeThemeVars,
  tooltipStyle,
  hasChartData,
}) => {
  const retentionData = useRetentionData(tasks, flashcards)
  const heatmapData = useHeatmapData(allLogs)
  const moodDistribution = useMoodDistribution(monthLogs, activeThemeVars)
  const estimationInsight = useEstimationInsight(tasks)

  return (
    <div className="flex flex-col gap-6 w-full flex-1 animate-fade-in">
      <SummaryMetricsRow
        monthLogs={monthLogs}
        totalMonthHours={totalMonthHours}
        totalWeeklyBreakHours={totalWeeklyBreakHours}
        totalDaysInMonth={totalDaysInMonth}
        currentStreak={currentStreak}
      />
      <TrendsChartsPanel
        chartData={chartData}
        hasChartData={hasChartData}
        activeThemeVars={activeThemeVars}
        tooltipStyle={tooltipStyle}
      />
      <RetentionChartPanel retentionData={retentionData} tooltipStyle={tooltipStyle} />
      <HeatmapPanel heatmapData={heatmapData} accentBlue={activeThemeVars.accentBlue} />
      <BreakdownPanels
        categoryBreakdown={categoryBreakdown}
        moodDistribution={moodDistribution}
        topSubject={topSubject}
        avgMin={avgMin}
        completionRate={completionRate}
        peakDay={peakDay}
        estimationInsight={estimationInsight}
      />
    </div>
  )
}
