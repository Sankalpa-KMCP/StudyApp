import React, { useMemo } from 'react'
import { Clock, Coffee, Calendar, Flame, Award, CheckCircle } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { TaskItem, DailyLog } from '../db/types'

interface AnalyticsStudioProps {
  tasks: TaskItem[]
  monthLogs: DailyLog[]
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
  activeThemeVars: any
  tooltipStyle: any
  hasChartData: boolean
}

export const AnalyticsStudio: React.FC<AnalyticsStudioProps> = ({
  tasks,
  monthLogs,
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
  hasChartData
}) => {
  
  // Calculate SM-2 Spaced Repetition Retention Telemetry
  const retentionData = useMemo(() => {
    const gradedTasks = tasks.filter(t => t.completed && t.latestGrade !== undefined)
    const groupedByDate: Record<string, { sum: number; count: number }> = {}
    
    gradedTasks.forEach(t => {
      const d = new Date(t.createdAt)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = { sum: 0, count: 0 }
      }
      groupedByDate[dateStr].sum += t.latestGrade!
      groupedByDate[dateStr].count += 1
    })

    return Object.keys(groupedByDate)
      .sort() // Sort chronologically
      .map(dateStr => {
        const g = groupedByDate[dateStr]
        return {
          date: dateStr.substring(5), // E.g. "06-07"
          avgGrade: parseFloat((g.sum / g.count).toFixed(1))
        }
      })
  }, [tasks])

  const hasRetentionData = retentionData.length > 0

  return (
    <div className="flex flex-col gap-6 w-full flex-1 animate-fade-in">
      
      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Monthly Study Time', value: `${totalMonthHours.toFixed(1)}h`, icon: Clock },
          { label: 'Weekly Break Cooldown', value: `${totalWeeklyBreakHours}h`, icon: Coffee },
          { label: 'Active Study Days', value: `${new Set(monthLogs.filter(l => l.studyMinutes > 0).map(l => l.dateString)).size} / ${totalDaysInMonth}`, icon: Calendar },
          { label: 'Streak Status', value: `${currentStreak} Days`, icon: Flame },
        ].map(item => {
          const Icon = item.icon
          return (
            <div key={item.label} className="border border-white/[0.06] dynamic-card p-5 flex items-center justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
              <div>
                <p className="text-[10px] text-white/60 font-semibold uppercase tracking-wider">{item.label}</p>
                <p className="text-xl font-semibold text-white mt-1 font-mono">{item.value}</p>
              </div>
              <div className="h-11 w-11 rounded-xl flex items-center justify-center border border-white/10 bg-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                <Icon className="h-5 w-5 text-white" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Recharts Performance Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 border border-white/[0.06] dynamic-card p-6">
          <h3 className="text-xs font-semibold text-white/80 tracking-wider uppercase mb-5">Weekly Performance Trends</h3>
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
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="hours" stroke={activeThemeVars.accentBlue} strokeWidth={2.5} fill="url(#trendsGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[220px] items-center justify-center">
              <p className="text-xs text-slate-500 italic">No study hours logged for this period.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 border border-white/[0.06] dynamic-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-350 tracking-wider uppercase mb-5">Daily Efficiency Index</h3>
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
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }} />
                    <YAxis hide />
                    <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`${val}%`, 'Efficiency']} />
                    <Bar dataKey="focus" fill="url(#effGrad)" radius={[4, 4, 0, 0]} maxBarSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center">
                <p className="text-xs text-slate-500 italic">No activity indexes logged.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Spaced Repetition Retention Telemetry Chart */}
      <div className="border border-white/[0.06] dynamic-card p-6">
        <h3 className="text-xs font-semibold text-white/80 tracking-wider uppercase mb-5">Retention Telemetry (SM-2 Active Recall)</h3>
        {hasRetentionData ? (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={retentionData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" horizontal={true} vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} />
                <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`${val} / 5`, 'Avg Recall Score']} />
                <Line type="monotone" dataKey="avgGrade" stroke="var(--color-accent-amber)" strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ strokeWidth: 2, r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[180px] items-center justify-center flex-col gap-2 border border-dashed border-white/5 rounded-2xl bg-black/10">
            <span className="text-2xl">📈</span>
            <p className="text-xs text-slate-500 italic">Complete active recall reviews to display retention metrics.</p>
          </div>
        )}
      </div>

      {/* Subject Breakdown & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 border border-white/[0.06] dynamic-card p-6">
          <h3 className="text-xs font-semibold text-white/80 tracking-wider uppercase mb-5">Subject Distribution</h3>
          {categoryBreakdown.length > 0 ? (
            <div className="flex items-center gap-8 justify-around">
              <div className="w-32 h-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="hours"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={32}
                      outerRadius={48}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2.5 flex-1 max-w-[220px]">
                {categoryBreakdown.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-semibold">
                    <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-text-primary flex-1 truncate">{item.name}</span>
                    <span className="text-slate-400 font-mono">{item.hours}h</span>
                    <span className="text-slate-500 font-mono text-[10px]">({item.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-12 text-center text-xs italic text-slate-500">
              Configure categories and complete focus blocks to display breakdowns.
            </p>
          )}
        </div>

        <div className="lg:col-span-6 border border-white/[0.06] dynamic-card p-6">
          <h3 className="text-xs font-semibold text-white/80 tracking-wider uppercase mb-5">Productivity Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'TOP SUBJECT', value: topSubject || 'No logs', icon: Award, color: 'text-accent-purple', bg: 'bg-accent-purple/5' },
              { label: 'AVG SESSION LENGTH', value: `${avgMin} min`, icon: Clock, color: 'text-accent-blue', bg: 'bg-accent-blue/5' },
              { label: 'COMPLETION RATIO', value: `${completionRate}%`, icon: CheckCircle, color: 'text-accent-green', bg: 'bg-accent-green/5' },
              { label: 'PEAK WORKDAY', value: peakDay || 'No logs', icon: Calendar, color: 'text-accent-amber', bg: 'bg-accent-amber/5' },
            ].map(insight => {
              const Icon = insight.icon
              return (
                <div key={insight.label} className="rounded-xl border border-white/5 bg-[#0c0f17]/40 p-4 hover:border-white/10 transition-all flex items-center gap-4">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${insight.bg}`}>
                    <Icon className={`h-4.5 w-4.5 ${insight.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold tracking-wider text-slate-450 uppercase">{insight.label}</p>
                    <p className="text-sm font-extrabold text-text-primary truncate mt-0.5">{insight.value}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
