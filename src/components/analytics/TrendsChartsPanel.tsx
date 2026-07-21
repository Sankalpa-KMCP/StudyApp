import { memo, useMemo, type CSSProperties } from 'react'
import { BarChart3 } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { ThemeProfile } from '../../types/app'
import { PanelCard } from '../shared/PanelCard'
import { PanelHeader } from '../shared/PanelHeader'
import { EmptyState } from '../shared/EmptyState'
import { ChartSummary } from './ChartSummary'
import { useTranslation } from '../../i18n/useTranslation'

const CHART_TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: 'color-mix(in srgb, var(--color-surface-card) 92%, transparent)',
  backdropFilter: 'blur(16px)',
  border: '1px solid var(--color-border-card)',
  borderRadius: '12px',
  boxShadow: 'var(--shadow-elevated)',
  color: 'var(--color-text-primary)',
  outline: 'none',
}

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
  suppressEmptyState = false,
}: Omit<TrendsChartsPanelProps, 'tooltipStyle'>) {
  const { t } = useTranslation()
  const weekHours = useMemo(() => chartData.reduce((sum, row) => sum + row.hours, 0), [chartData])
  const topDay = useMemo(
    () => chartData.reduce<{ day: string; hours: number } | null>((best, row) => {
      if (!best || row.hours > best.hours) return { day: row.day, hours: row.hours }
      return best
    }, null),
    [chartData],
  )

  const weeklySummary = topDay
    ? t('analyticsWeeklySummary', {
        hours: weekHours.toFixed(1),
        topDay: t('analyticsWeeklyTopDay', { day: topDay.day, hours: topDay.hours.toFixed(1) }),
      })
    : t('analyticsWeeklySummary', { hours: weekHours.toFixed(1), topDay: '' })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <PanelCard className="lg:col-span-8" aria-labelledby="analytics-weekly-trends">
        <PanelHeader title={t('analyticsWeeklyTrends')} bordered={false} className="mb-5" id="analytics-weekly-trends" />
        {hasChartData ? (
          <>
          <ChartSummary>{weeklySummary}</ChartSummary>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={activeThemeVars.accentBlue} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={activeThemeVars.accentBlue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--color-text-primary) 4%, transparent)" horizontal={true} vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 11, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 11, fontWeight: 600 }} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="hours" stroke={activeThemeVars.accentBlue} strokeWidth={2.5} fill="url(#trendsGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          </>
        ) : suppressEmptyState ? null : (
          <EmptyState
            icon={<BarChart3 className="h-8 w-8" />}
            title={t('analyticsNoStudyDataTitle')}
            description={t('analyticsNoStudyDataDesc')}
          />
        )}
      </PanelCard>

      <PanelCard className="lg:col-span-4 flex flex-col justify-between" aria-labelledby="analytics-efficiency-index">
        <div>
          <PanelHeader title={t('analyticsEfficiencyIndex')} bordered={false} className="mb-5" id="analytics-efficiency-index" />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--color-text-primary) 4%, transparent)" horizontal={true} vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontWeight: 600 }} />
                  <YAxis hide />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(val) => [`${val}%`, t('analyticsEfficiencyTooltip')]} />
                  <Bar dataKey="focus" fill="url(#effGrad)" radius={[4, 4, 0, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : suppressEmptyState ? null : (
            <EmptyState
              icon={<BarChart3 className="h-8 w-8" />}
              title={t('analyticsNoEfficiencyTitle')}
              description={t('analyticsNoEfficiencyDesc')}
            />
          )}
        </div>
      </PanelCard>
    </div>
  )
})
