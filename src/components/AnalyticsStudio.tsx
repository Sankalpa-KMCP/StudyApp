import React, { lazy, Suspense } from 'react'
import type { TaskItem, DailyLog } from '../db/types'
import type { ThemeProfile } from '../types/app'
import type { CSSProperties } from 'react'
import { SummaryMetricsRow } from './analytics/SummaryMetricsRow'
import { HeatmapPanel } from './analytics/HeatmapPanel'

const TrendsChartsPanel = lazy(() => import('./analytics/TrendsChartsPanel').then(m => ({ default: m.TrendsChartsPanel })))
const RetentionChartPanel = lazy(() => import('./analytics/RetentionChartPanel').then(m => ({ default: m.RetentionChartPanel })))
const BreakdownPanels = lazy(() => import('./analytics/BreakdownPanels').then(m => ({ default: m.BreakdownPanels })))

function ChartPanelFallback() {
  return <div className="h-48 animate-pulse rounded-2xl surface-subtle" aria-hidden />
}
import { AnalyticsEmptyHero } from './analytics/AnalyticsEmptyHero'
import { AnalyticsRangeSelector } from './analytics/AnalyticsRangeSelector'
import { CategoryGoalTrendPanel } from './analytics/CategoryGoalTrendPanel'
import { TabPageShell, TabSection } from './shared/TabPageShell'
import { Button } from './shared/Button'
import type { AnalyticsHistoryRange } from '../hooks/useAnalyticsHistoryRange'
import {
  useHeatmapData,
  useRetentionData,
  useMoodDistribution,
  useEstimationInsight,
} from './analytics/useAnalyticsChartData'
import { useTranslation } from '../i18n/useTranslation'

interface AnalyticsStudioProps {
  tasks: TaskItem[]
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
  categoryGoalTrends?: Array<{
    name: string
    color: string
    goalMinutes: number
    hitDays: number
    totalDays: number
    hitRate: number
  }>
  onExportWeeklyReport?: (format: 'md' | 'csv') => void
}

export const AnalyticsStudio: React.FC<AnalyticsStudioProps> = ({
  tasks,
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
  categoryGoalTrends = [],
  onExportWeeklyReport,
}) => {
  const { t } = useTranslation()
  const retentionData = useRetentionData(tasks)
  const heatmapData = useHeatmapData(allLogs)
  const moodDistribution = useMoodDistribution(monthLogs, activeThemeVars)
  const estimationInsight = useEstimationInsight(tasks)

  const totalHeatmapMinutes = heatmapData.reduce((sum, day) => sum + day.minutes, 0)
  const isFullyEmpty = !hasChartData && retentionData.length === 0 && totalHeatmapMinutes === 0

  return (
    <TabPageShell>
      <TabSection label={t('analyticsSectionOverview')}>
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

      <TabSection label={t('analyticsSectionTrends')}>
        {isFullyEmpty && onStartFocus ? (
          <AnalyticsEmptyHero onStartFocus={onStartFocus} />
        ) : (
          <Suspense fallback={<ChartPanelFallback />}>
            <TrendsChartsPanel
              chartData={chartData}
              hasChartData={hasChartData}
              activeThemeVars={activeThemeVars}
              tooltipStyle={tooltipStyle}
              suppressEmptyState={isFullyEmpty}
            />
          </Suspense>
        )}
      </TabSection>

      {!isFullyEmpty && (
        <>
          <TabSection label={t('analyticsSectionRetention')} className="lg:col-span-6">
            <Suspense fallback={<ChartPanelFallback />}>
              <RetentionChartPanel
                retentionData={retentionData}
                tooltipStyle={tooltipStyle}
                suppressEmptyState={retentionData.length > 0}
              />
            </Suspense>
          </TabSection>

          <TabSection label={t('analyticsSectionActivityMap')} className="lg:col-span-6">
            <HeatmapPanel
              heatmapData={heatmapData}
              accentBlue={activeThemeVars.accentBlue}
              suppressEmptyState={totalHeatmapMinutes > 0}
            />
          </TabSection>
        </>
      )}

      <TabSection label={t('analyticsSectionInsights')}>
        {onExportWeeklyReport && (
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant="secondary" size="sm" onClick={() => onExportWeeklyReport('md')}>{t('analyticsExportWeeklyMd')}</Button>
            <Button variant="secondary" size="sm" onClick={() => onExportWeeklyReport('csv')}>{t('analyticsExportWeeklyCsv')}</Button>
          </div>
        )}
        <AnalyticsRangeSelector range={analyticsRange} onChange={onAnalyticsRangeChange} />
        <p className="text-micro settings-muted mb-4 -mt-2">
          {t('analyticsProductivityWindowNote', { range: analyticsRangeLabel.toLowerCase() })}
        </p>
        <Suspense fallback={<ChartPanelFallback />}>
          <BreakdownPanels
            categoryBreakdown={categoryBreakdown}
            moodDistribution={moodDistribution}
            topSubject={topSubject}
            avgMin={avgMin}
            completionRate={completionRate}
            peakDay={peakDay}
            estimationInsight={estimationInsight}
          />
        </Suspense>
        {categoryGoalTrends.length > 0 && (
          <div className="mt-4">
            <CategoryGoalTrendPanel trends={categoryGoalTrends} />
          </div>
        )}
      </TabSection>
    </TabPageShell>
  )
}
