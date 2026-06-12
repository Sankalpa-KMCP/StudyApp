import React from 'react'
import type { TaskItem, DailyLog, FlashcardItem } from '../db/types'
import type { ThemeProfile } from '../types/app'
import type { CSSProperties } from 'react'
import { SummaryMetricsRow } from './analytics/SummaryMetricsRow'
import { TrendsChartsPanel } from './analytics/TrendsChartsPanel'
import { RetentionChartPanel } from './analytics/RetentionChartPanel'
import { HeatmapPanel } from './analytics/HeatmapPanel'
import { BreakdownPanels } from './analytics/BreakdownPanels'
import { AnalyticsEmptyHero } from './analytics/AnalyticsEmptyHero'
import { AnalyticsRangeSelector } from './analytics/AnalyticsRangeSelector'
import { TabPageShell, TabSection } from './shared/TabPageShell'
import type { AnalyticsHistoryRange } from '../hooks/useAnalyticsHistoryRange'
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
  analyticsRange: AnalyticsHistoryRange
  analyticsRangeLabel: string
  onAnalyticsRangeChange: (range: AnalyticsHistoryRange) => void
  onStartFocus?: () => void
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
  analyticsRange,
  analyticsRangeLabel,
  onAnalyticsRangeChange,
  onStartFocus,
}) => {
  const retentionData = useRetentionData(tasks, flashcards)
  const heatmapData = useHeatmapData(allLogs)
  const moodDistribution = useMoodDistribution(monthLogs, activeThemeVars)
  const estimationInsight = useEstimationInsight(tasks)

  const totalHeatmapMinutes = heatmapData.reduce((sum, day) => sum + day.minutes, 0)
  const isFullyEmpty = !hasChartData && retentionData.length === 0 && totalHeatmapMinutes === 0

  return (
    <TabPageShell>
      <TabSection label="Overview">
        {!isFullyEmpty && (
          <SummaryMetricsRow
            monthLogs={monthLogs}
            totalMonthHours={totalMonthHours}
            totalWeeklyBreakHours={totalWeeklyBreakHours}
            totalDaysInMonth={totalDaysInMonth}
            currentStreak={currentStreak}
          />
        )}
      </TabSection>

      <TabSection label="Trends">
        {isFullyEmpty && onStartFocus ? (
          <AnalyticsEmptyHero onStartFocus={onStartFocus} />
        ) : (
          <TrendsChartsPanel
            chartData={chartData}
            hasChartData={hasChartData}
            activeThemeVars={activeThemeVars}
            tooltipStyle={tooltipStyle}
            suppressEmptyState={isFullyEmpty}
          />
        )}
      </TabSection>

      {!isFullyEmpty && (
        <>
          <TabSection label="Retention" className="lg:col-span-6">
            <RetentionChartPanel
              retentionData={retentionData}
              tooltipStyle={tooltipStyle}
              suppressEmptyState={retentionData.length > 0}
            />
          </TabSection>

          <TabSection label="Activity map" className="lg:col-span-6">
            <HeatmapPanel
              heatmapData={heatmapData}
              accentBlue={activeThemeVars.accentBlue}
              suppressEmptyState={totalHeatmapMinutes > 0}
            />
          </TabSection>
        </>
      )}

      <TabSection label="Insights">
        <AnalyticsRangeSelector range={analyticsRange} onChange={onAnalyticsRangeChange} />
        <p className="text-micro settings-muted mb-4 -mt-2">
          Productivity metrics below reflect {analyticsRangeLabel.toLowerCase()}. Streak and XP use all-time data.
        </p>
        <BreakdownPanels
          categoryBreakdown={categoryBreakdown}
          moodDistribution={moodDistribution}
          topSubject={topSubject}
          avgMin={avgMin}
          completionRate={completionRate}
          peakDay={peakDay}
          estimationInsight={estimationInsight}
        />
      </TabSection>
    </TabPageShell>
  )
}
