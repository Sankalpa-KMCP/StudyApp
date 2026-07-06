import { memo, useMemo, type CSSProperties } from 'react'
import { BarChart3 } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { ThemeProfile } from '../../types/app'
import { PanelCard } from '../shared/PanelCard'
import { PanelHeader } from '../shared/PanelHeader'
import { EmptyState } from '../shared/EmptyState'
import { ChartSummary } from './ChartSummary'

interface TrendsChartsPanelProps {
  chartData: Array<{ day: string; hours: number; focus: number }>
  hasChartData: boolean
  activeThemeVars: ThemeProfile
  tooltipStyle: CSSProperties
  suppressEmptyState?: boolean
}

export const TrendsChartsPanel = memo(function TrendsChartsPanel({
  chartData,
  hasChartData,
  activeThemeVars,
  tooltipStyle,
  suppressEmptyState = false,
}: TrendsChartsPanelProps) {
  const weekHours = useMemo(() => chartData.reduce((sum, row) => sum + row.hours, 0), [chartData])
  const topDay = useMemo(
    () => chartData.reduce<{ day: string; hours: number } | null>((best, row) => {
      if (!best || row.hours > best.hours) return { day: row.day, hours: row.hours }
      return best
    }, null),
    [chartData],
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <PanelCard className="lg:col-span-8" aria-labelledby="analytics-weekly-trends">
        <PanelHeader title="Weekly performance trends" bordered={false} className="mb-5" id="analytics-weekly-trends" />
        {hasChartData ? (
          <>
          <ChartSummary>
            {`This week: ${weekHours.toFixed(1)} hours studied.${topDay ? ` Top day: ${topDay.day} (${topDay.hours.toFixed(1)} hours).` : ''}`}
          </ChartSummary>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={activeThemeVars.accentBlue} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={activeThemeVars.accentBlue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" horizontal={true} vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="hours" stroke={activeThemeVars.accentBlue} strokeWidth={2.5} fill="url(#trendsGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          </>
        ) : suppressEmptyState ? null : (
          <EmptyState
            icon={<BarChart3 className="h-8 w-8" />}
            title="No study data yet"
            description="Complete a focus block to see your weekly trends here."
          />
        )}
      </PanelCard>

      <PanelCard className="lg:col-span-4 flex flex-col justify-between" aria-labelledby="analytics-efficiency-index">
        <div>
          <PanelHeader title="Daily efficiency index" bordered={false} className="mb-5" id="analytics-efficiency-index" />
          {hasChartData ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="effGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={activeThemeVars.accentBlue} />
                      <stop offset="100%" stopColor={activeThemeVars.accentPurple} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" horizontal={true} vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600 }} />
                  <YAxis hide />
                  <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`${val}%`, 'Efficiency']} />
                  <Bar dataKey="focus" fill="url(#effGrad)" radius={[4, 4, 0, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : suppressEmptyState ? null : (
            <EmptyState
              icon={<BarChart3 className="h-8 w-8" />}
              title="No efficiency data"
              description="Your focus scores will appear after you log sessions."
            />
          )}
        </div>
      </PanelCard>
    </div>
  )
})
