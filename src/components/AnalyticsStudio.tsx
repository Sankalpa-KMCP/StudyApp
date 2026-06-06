import React, { useMemo } from 'react'
import { Clock, Coffee, Calendar, Flame, Award, CheckCircle, Target } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { TaskItem, DailyLog } from '../db/types'
import type { ThemeProfile } from '../types/app'
import type { CSSProperties } from 'react'
import { hexToRgb } from '../lib/studyDashboard'
import { PieChartLegend } from './shared/PieChartLegend'
import { useHeatmapData, useRetentionData } from './analytics/useAnalyticsChartData'

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
  hasChartData
}) => {
  
  const retentionData = useRetentionData(tasks)
  const hasRetentionData = retentionData.length > 0
  const heatmapData = useHeatmapData(allLogs)

  const rgb = useMemo(() => {
    return hexToRgb(activeThemeVars.accentBlue) || { r: 59, g: 130, b: 246 };
  }, [activeThemeVars.accentBlue]);

  const rgbStr = `${rgb.r}, ${rgb.g}, ${rgb.b}`;

  // Calculate estimation deviation insight
  const estimationInsight = useMemo(() => {
    const completedTasks = tasks.filter(t => t.completed && t.estimatedCycles > 0)
    if (completedTasks.length === 0) return 'No data'
    
    let totalEstimated = 0
    let totalActual = 0
    
    completedTasks.forEach(t => {
      totalEstimated += t.estimatedCycles
      totalActual += t.actualCycles
    })
    
    const diff = Math.abs(totalActual - totalEstimated)
    const errorRate = Math.round((diff / totalEstimated) * 100)
    
    if (totalActual === totalEstimated) return '0% Dev (Perfect)'
    return `${errorRate}% Dev (${totalActual > totalEstimated ? 'Under' : 'Over'})`
  }, [tasks])

  // Calculate monthly mood distribution metrics
  const moodDistribution = useMemo(() => {
    const counts: Record<string, number> = {
      focused: 0,
      energetic: 0,
      tired: 0,
      distracted: 0,
    }
    let totalLogged = 0

    monthLogs.forEach(log => {
      if (log.mood && counts[log.mood] !== undefined) {
        counts[log.mood]++
        totalLogged++
      }
    })

    const colors: Record<string, string> = {
      focused: activeThemeVars?.accentBlue ?? '#3b82f6',
      energetic: activeThemeVars?.accentGreen ?? '#10b981',
      tired: activeThemeVars?.accentAmber ?? '#f59e0b',
      distracted: '#ef4444', // red
    }

    const emojis: Record<string, string> = {
      focused: '🧠',
      energetic: '⚡',
      tired: '🥱',
      distracted: '🌪',
    }

    return Object.keys(counts).map(key => {
      const count = counts[key]
      const percentage = totalLogged > 0 ? Math.round((count / totalLogged) * 100) : 0
      return {
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value: count,
        percentage,
        color: colors[key],
        emoji: emojis[key],
      }
    })
  }, [monthLogs, activeThemeVars])

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
            <div key={item.label} className="border border-white/5 bg-white/[0.02] dynamic-card p-5 flex items-center justify-between shadow-2xl">
              <div>
                <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wider">{item.label}</p>
                <p className="text-xl font-bold text-white mt-1 font-mono">{item.value}</p>
              </div>
              <div className="h-11 w-11 rounded-full flex items-center justify-center border border-white/10 bg-white/5 shadow-inner">
                <Icon className="h-5 w-5 text-white" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Recharts Performance Trends */}
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

      {/* Spaced Repetition Retention Telemetry Chart */}
      <div className="border border-white/5 bg-white/[0.02] dynamic-card p-6" aria-labelledby="analytics-retention">
        <h3 id="analytics-retention" className="text-xs font-semibold text-white/80 tracking-wider uppercase mb-5">Retention Telemetry (SM-2 Active Recall)</h3>
        {hasRetentionData ? (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={retentionData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" horizontal={true} vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600 }} />
                <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`${val} / 5`, 'Avg Recall Score']} />
                <Line type="monotone" dataKey="avgGrade" stroke="var(--color-accent-amber)" strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ strokeWidth: 2, r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[180px] items-center justify-center flex-col gap-2 border border-dashed border-white/10 rounded-[24px] bg-black/20">
            <span className="text-2xl">📈</span>
            <p className="text-xs text-white/40 italic">Complete active recall reviews to display retention metrics.</p>
          </div>
        )}
      </div>

      {/* 365-Day Focus Heatmap */}
      <div className="border border-white/5 bg-white/[0.02] dynamic-card p-6 flex flex-col gap-5" aria-labelledby="analytics-heatmap">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 id="analytics-heatmap" className="text-xs font-semibold text-white/85 tracking-wider uppercase">Yearly Focus Horizon (365 Days)</h3>
          <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-semibold select-none">
            <span>Less</span>
            <div className="h-2.5 w-2.5 rounded-[2px] bg-white/5" />
            <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: `rgba(${rgbStr}, 0.20)` }} />
            <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: `rgba(${rgbStr}, 0.45)` }} />
            <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: `rgba(${rgbStr}, 0.70)` }} />
            <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: `rgba(${rgbStr}, 1.00)` }} />
            <span>More</span>
          </div>
        </div>

        <div className="relative w-full overflow-x-auto custom-scrollbar p-2 bg-black/20 border border-white/5 rounded-2xl">
          <div className="grid grid-flow-col grid-rows-7 gap-1 min-w-[650px] justify-start">
            {heatmapData.map(day => (
              <div
                key={day.dateStr}
                role="img"
                aria-label={`${day.dateStr}: ${day.minutes} minutes studied`}
                title={`${day.dateStr}: ${day.minutes}m`}
                className="w-2.5 h-2.5 rounded-[2px] cursor-pointer transition-transform hover:scale-125 relative group"
                style={{
                  backgroundColor: day.minutes === 0
                    ? 'rgba(255, 255, 255, 0.03)'
                    : day.minutes < 60
                    ? `rgba(${rgbStr}, 0.20)`
                    : day.minutes < 120
                    ? `rgba(${rgbStr}, 0.45)`
                    : day.minutes < 180
                    ? `rgba(${rgbStr}, 0.70)`
                    : `rgba(${rgbStr}, 1.00)`
                }}
              >
                {/* Custom hover tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col w-32 bg-[#161620]/95 backdrop-blur-xl border border-white/10 p-2 rounded-[12px] text-[8px] font-mono text-left pointer-events-none z-30 shadow-[0_8px_32px_rgba(0,0,0,0.35)] leading-normal">
                  <div className="font-bold text-white mb-0.5 border-b border-white/10 pb-0.5">
                    {day.dateStr}
                  </div>
                  <div className="text-white/80">⏱️ Study: {day.minutes}m</div>
                  <div className="text-accent-blue font-bold mt-0.5">Intensity: {day.minutes < 60 ? 'Low' : day.minutes < 120 ? 'Med' : day.minutes < 180 ? 'High' : 'Epic'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Subject Breakdown, Mood Distribution & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 border border-white/5 bg-white/[0.02] dynamic-card p-6" aria-labelledby="analytics-subjects">
          <h3 id="analytics-subjects" className="text-xs font-semibold text-white/80 tracking-wider uppercase mb-5">Subject Distribution</h3>
          {categoryBreakdown.length > 0 ? (
            <div className="flex items-center gap-8 justify-around">
              <div className="w-24 h-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="hours"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={20}
                      outerRadius={36}
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
              <PieChartLegend
                items={categoryBreakdown.map(item => ({
                  name: item.name,
                  color: item.color,
                  value: item.hours,
                  unit: 'h',
                  percentage: item.percentage,
                }))}
              />
            </div>
          ) : (
            <p className="py-12 text-center text-xs italic text-white/30">
              Configure categories and complete focus blocks.
            </p>
          )}
        </div>

        <div className="lg:col-span-4 border border-white/5 bg-white/[0.02] dynamic-card p-6" aria-labelledby="analytics-mood">
          <h3 id="analytics-mood" className="text-xs font-semibold text-white/80 tracking-wider uppercase mb-5">Mood Distribution</h3>
          {moodDistribution.some(m => m.value > 0) ? (
            <div className="flex items-center gap-8 justify-around">
              <div className="w-24 h-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={moodDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={20}
                      outerRadius={36}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {moodDistribution.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <PieChartLegend
                items={moodDistribution.map(item => ({
                  name: item.name,
                  color: item.color,
                  value: item.value,
                  unit: 'd',
                  percentage: item.percentage,
                  emoji: item.emoji,
                }))}
              />
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center text-center">
              <p className="text-xs italic text-white/30">
                Log mood in the activity tab to see distribution.
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 border border-white/5 bg-white/[0.02] dynamic-card p-6" aria-labelledby="analytics-productivity">
          <h3 id="analytics-productivity" className="text-xs font-semibold text-white/80 tracking-wider uppercase mb-5">Productivity Metrics</h3>
          <div className="grid grid-cols-1 gap-2.5">
            {[
              { label: 'TOP SUBJECT', value: topSubject || 'No logs', icon: Award, color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
              { label: 'AVG SESSION LENGTH', value: `${avgMin} min`, icon: Clock, color: 'text-accent-blue', bg: 'bg-accent-blue/10' },
              { label: 'COMPLETION RATIO', value: `${completionRate}%`, icon: CheckCircle, color: 'text-accent-green', bg: 'bg-accent-green/10' },
              { label: 'PEAK WORKDAY', value: peakDay || 'No logs', icon: Calendar, color: 'text-accent-amber', bg: 'bg-accent-amber/10' },
              { label: 'ESTIMATION DEVIATION', value: estimationInsight, icon: Target, color: 'text-accent-blue', bg: 'bg-accent-blue/10' },
            ].map(insight => {
              const Icon = insight.icon
              return (
                <div key={insight.label} className="rounded-xl border border-white/5 bg-black/20 p-2.5 hover:border-white/10 transition-all flex items-center gap-3">
                  <div className={`h-7.5 w-7.5 rounded-full flex items-center justify-center shrink-0 ${insight.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${insight.color}`} />
                  </div>
                  <div className="min-w-0 flex-1 flex justify-between items-center">
                    <p className="text-[9px] font-bold tracking-wider text-white/40 uppercase">{insight.label}</p>
                    <p className="text-xs font-extrabold text-white truncate">{insight.value}</p>
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
