import { Clock, Coffee, Calendar, Flame } from 'lucide-react'
import type { DailyLog } from '../../db/types'
import { MetricCard } from '../shared/MetricCard'

interface SummaryMetricsRowProps {
  monthLogs: DailyLog[]
  totalMonthHours: number
  totalWeeklyBreakHours: number
  totalDaysInMonth: number
  currentStreak: number
}

export function SummaryMetricsRow({
  monthLogs,
  totalMonthHours,
  totalWeeklyBreakHours,
  totalDaysInMonth,
  currentStreak,
}: SummaryMetricsRowProps) {
  const activeStudyDays = new Set(monthLogs.filter(l => l.studyMinutes > 0).map(l => l.dateString)).size

  const items = [
    { label: 'Monthly Study Time', value: `${totalMonthHours.toFixed(1)}h`, icon: Clock, accent: 'blue' as const },
    { label: 'Weekly Break Cooldown', value: `${totalWeeklyBreakHours}h`, icon: Coffee, accent: 'purple' as const },
    { label: 'Active Study Days', value: `${activeStudyDays} / ${totalDaysInMonth}`, icon: Calendar, accent: 'green' as const },
    { label: 'Streak Status', value: `${currentStreak} Days`, icon: Flame, accent: 'amber' as const },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map(item => (
        <MetricCard key={item.label} label={item.label} value={item.value} icon={item.icon} accent={item.accent} />
      ))}
    </div>
  )
}
