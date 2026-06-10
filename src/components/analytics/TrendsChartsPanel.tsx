import type { CSSProperties } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { ThemeProfile } from '../../types/app'

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
      <div className="lg:col-span-8 border border-white/5 bg-white/[0.02] dynamic-card p-6" aria-labelledby="analytics-weekly-trends">
        <h3 id="analytics-weekly-trends" className="text-xs font-semibold text-white/80 tracking-wider uppercase mb-5">Weekly Performance Trends</h3>
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
          <div className="flex h-[220px] items-center justify-center">
            <p className="text-xs text-white/40 italic">No study hours logged for this period.</p>
          </div>
        )}
      </div>

      <div className="lg:col-span-4 border border-white/5 bg-white/[0.02] dynamic-card p-6 flex flex-col justify-between" aria-labelledby="analytics-efficiency-index">
        <div>
          <h3 id="analytics-efficiency-index" className="text-xs font-bold text-white/70 tracking-wider uppercase mb-5">Daily Efficiency Index</h3>
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
            <div className="flex h-[200px] items-center justify-center">
              <p className="text-xs text-white/40 italic">No activity indexes logged.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
