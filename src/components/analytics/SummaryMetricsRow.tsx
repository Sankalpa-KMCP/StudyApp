import { Clock, Coffee, Calendar, Flame } from 'lucide-react'
import type { DailyLog } from '../../db/types'
import { Card } from '../shared/Card'

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
    { label: 'Monthly Study Time', value: `${totalMonthHours.toFixed(1)}h`, icon: Clock },
    { label: 'Weekly Break Cooldown', value: `${totalWeeklyBreakHours}h`, icon: Coffee },
    { label: 'Active Study Days', value: `${activeStudyDays} / ${totalDaysInMonth}`, icon: Calendar },
    { label: 'Streak Status', value: `${currentStreak} Days`, icon: Flame },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map(item => {
        const Icon = item.icon
        return (
          <Card key={item.label} variant="elevated" padding="md" className="flex items-center justify-between">
            <div>
              <p className="text-caption text-white/50 font-semibold uppercase tracking-wider">{item.label}</p>
              <p className="text-xl font-bold text-white mt-1 font-mono">{item.value}</p>
            </div>
            <div className="h-11 w-11 rounded-full flex items-center justify-center border border-white/10 bg-white/5 shadow-inner">
              <Icon className="h-5 w-5 text-white" />
            </div>
          </Card>
        )
      })}
    </div>
  )
}
