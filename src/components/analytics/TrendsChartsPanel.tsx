import type { CSSProperties } from 'react'
import { BarChart3 } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { ThemeProfile } from '../../types/app'
import { Card } from '../shared/Card'
import { EmptyState } from '../shared/EmptyState'

interface TrendsChartsPanelProps {
  chartData: Array<{ day: string; hours: number; focus: number }>
  hasChartData: boolean
  activeThemeVars: ThemeProfile
  tooltipStyle: CSSProperties
}

export function TrendsChartsPanel({
  chartData,
  hasChartData,
  activeThemeVars,
  tooltipStyle,
}: TrendsChartsPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <Card className="lg:col-span-8" padding="md" aria-labelledby="analytics-weekly-trends">
        <h3 id="analytics-weekly-trends" className="text-caption font-semibold text-white/80 tracking-wider uppercase mb-5">Weekly Performance Trends</h3>
        {hasChartData ? (
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
        ) : (
          <EmptyState
            icon={<BarChart3 className="h-8 w-8" />}
            title="No study data yet"
            description="Complete a focus block to see your weekly trends here."
          />
        )}
      </Card>

      <Card className="lg:col-span-4 flex flex-col justify-between" padding="md" aria-labelledby="analytics-efficiency-index">
        <div>
          <h3 id="analytics-efficiency-index" className="text-caption font-bold text-white/70 tracking-wider uppercase mb-5">Daily Efficiency Index</h3>
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
          ) : (
            <EmptyState
              icon={<BarChart3 className="h-8 w-8" />}
              title="No efficiency data"
              description="Your focus scores will appear after you log sessions."
            />
          )}
        </div>
      </Card>
    </div>
  )
}
