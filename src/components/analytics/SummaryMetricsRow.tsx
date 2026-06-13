import { memo, useMemo } from 'react'
import { Clock, Coffee, Calendar, Flame } from 'lucide-react'
import type { DailyLog } from '../../db/types'
import { MetricCard } from '../shared/MetricCard'
import { useTranslation } from '../../i18n/useTranslation'

interface SummaryMetricsRowProps {
  monthLogs: DailyLog[]
  totalMonthHours: number
  totalWeeklyBreakHours: number
  totalDaysInMonth: number
  currentStreak: number
}

export const SummaryMetricsRow = memo(function SummaryMetricsRow({
  monthLogs,
  totalMonthHours,
  totalWeeklyBreakHours,
  totalDaysInMonth,
  currentStreak,
}: SummaryMetricsRowProps) {
  const { t } = useTranslation()

  const activeStudyDays = useMemo(
    () => new Set(monthLogs.filter(l => l.studyMinutes > 0).map(l => l.dateString)).size,
    [monthLogs],
  )

  const items = useMemo(
    () => [
      { label: t('analyticsMetricMonthlyStudy'), value: `${totalMonthHours.toFixed(1)}h`, icon: Clock, accent: 'blue' as const },
      { label: t('analyticsMetricWeeklyBreak'), value: `${totalWeeklyBreakHours}h`, icon: Coffee, accent: 'purple' as const },
      { label: t('analyticsMetricActiveDays'), value: `${activeStudyDays} / ${totalDaysInMonth}`, icon: Calendar, accent: 'green' as const },
      { label: t('analyticsMetricStreak'), value: t('analyticsMetricStreakValue', { count: currentStreak }), icon: Flame, accent: 'amber' as const },
    ],
    [activeStudyDays, totalMonthHours, totalWeeklyBreakHours, totalDaysInMonth, currentStreak, t],
  )

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map(item => (
        <MetricCard key={item.label} label={item.label} value={item.value} icon={item.icon} accent={item.accent} />
      ))}
    </div>
  )
})
