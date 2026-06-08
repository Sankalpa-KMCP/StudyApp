import { lazy, Suspense } from 'react'
import { TOOLTIP_STYLE } from '../../lib/theme'
import { TabLoadingFallback } from '../shared/TabLoadingFallback'
import { useStudyAnalytics, useStudyData, useStudyUI } from '../../context/useStudyApp'

const AnalyticsStudio = lazy(() =>
  import('../AnalyticsStudio').then(m => ({ default: m.AnalyticsStudio }))
)

export function AnalyticsTab() {
  const { tasks } = useStudyData()
  const { currentStreak, xpData, insights, breakdownData, journal, allLogs } = useStudyAnalytics()
  const { activeThemeVars } = useStudyUI()
  const { calendar } = journal

  return (
    <Suspense fallback={<TabLoadingFallback label="analytics" />}>
      <AnalyticsStudio
        tasks={tasks.tasks}
        monthLogs={calendar.monthLogs}
        allLogs={allLogs.allLogs}
        totalMonthHours={calendar.totalMonthHours}
        totalWeeklyBreakHours={calendar.totalWeeklyBreakHours}
        totalDaysInMonth={calendar.totalDaysInMonth}
        currentStreak={currentStreak}
        level={xpData.level}
        chartData={calendar.chartData}
        categoryBreakdown={breakdownData.breakdown}
        topSubject={insights.topSubject}
        avgMin={insights.avgMin}
        completionRate={insights.completionRate}
        peakDay={insights.peakDay}
        activeThemeVars={activeThemeVars}
        tooltipStyle={TOOLTIP_STYLE}
        hasChartData={calendar.hasChartData}
      />
    </Suspense>
  )
}
