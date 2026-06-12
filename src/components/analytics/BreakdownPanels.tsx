import { Clock, Calendar, Award, CheckCircle, Target } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { PieChartLegend } from '../shared/PieChartLegend'
import { PanelCard } from '../shared/PanelCard'
import { PanelHeader } from '../shared/PanelHeader'
import { ChartSummary } from './ChartSummary'

interface CategoryItem {
  name: string
  color: string
  hours: number
  percentage: number
}

interface MoodItem {
  name: string
  value: number
  percentage: number
  color: string
  emoji: string
}

interface BreakdownPanelsProps {
  categoryBreakdown: CategoryItem[]
  moodDistribution: MoodItem[]
  topSubject: string
  avgMin: number
  completionRate: number
  peakDay: string
  estimationInsight: string
}

export function BreakdownPanels({
  categoryBreakdown,
  moodDistribution,
  topSubject,
  avgMin,
  completionRate,
  peakDay,
  estimationInsight,
}: BreakdownPanelsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <PanelCard className="lg:col-span-4" aria-labelledby="analytics-subjects" interactive={true}>
        <PanelHeader title="Subject distribution" bordered={false} className="mb-5" id="analytics-subjects" />
        {categoryBreakdown.length > 0 ? (
          <>
          <ChartSummary>
            {`Top category: ${topSubject}. Average session length ${avgMin} minutes. Completion rate ${completionRate}%. Peak study day: ${peakDay}.`}
          </ChartSummary>
          <div className="flex items-center gap-8 justify-around">
            <div className="w-24 h-24 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="hours" nameKey="name" cx="50%" cy="50%" innerRadius={20} outerRadius={36} paddingAngle={4} stroke="none">
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
          </>
        ) : (
          <p className="py-12 text-center text-xs italic text-white/30">Configure categories and complete focus blocks.</p>
        )}
      </PanelCard>

      <PanelCard className="lg:col-span-4" aria-labelledby="analytics-mood" interactive={true}>
        <PanelHeader title="Mood distribution" bordered={false} className="mb-5" id="analytics-mood" />
        {moodDistribution.some(m => m.value > 0) ? (
          <div className="flex items-center gap-8 justify-around">
            <div className="w-24 h-24 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={moodDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={20} outerRadius={36} paddingAngle={4} stroke="none">
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
            <p className="text-xs italic text-white/30">Log mood in the Journal tab to see distribution.</p>
          </div>
        )}
      </PanelCard>

      <PanelCard className="lg:col-span-4" aria-labelledby="analytics-productivity" interactive={true}>
        <PanelHeader title="Productivity metrics" bordered={false} className="mb-5" id="analytics-productivity" />
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
      </PanelCard>
    </div>
  )
}
