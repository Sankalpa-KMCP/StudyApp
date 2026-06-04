import { lazy, Suspense } from 'react'
import { TOOLTIP_STYLE } from '../../lib/theme'
import { useStudyAnalytics, useStudyApp } from '../../context/useStudyApp'

const AnalyticsStudio = lazy(() =>
  import('../AnalyticsStudio').then(m => ({ default: m.AnalyticsStudio }))
)

export function AnalyticsTab() {
  const { tasks } = useStudyApp()
  const { currentStreak, xpData, insights, breakdownData, journal, allLogs } = useStudyAnalytics()
  const { calendar } = journal
  const { activeThemeVars } = useStudyApp()

  return (
    <Suspense fallback={<div className="text-white/50 text-sm p-8">Loading analytics...</div>}>
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
