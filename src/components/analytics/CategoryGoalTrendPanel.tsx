import { memo } from 'react'
import { PanelCard } from '../shared/PanelCard'
import { PanelHeader } from '../shared/PanelHeader'
import { EmptyState } from '../shared/EmptyState'

interface CategoryGoalTrendPanelProps {
  trends: Array<{
    name: string
    color: string
    goalMinutes: number
    hitDays: number
    totalDays: number
    hitRate: number
  }>
}

export const CategoryGoalTrendPanel = memo(function CategoryGoalTrendPanel({ trends }: CategoryGoalTrendPanelProps) {
  return (
    <PanelCard>
      <PanelHeader title="Category goal trends" bordered={false} className="mb-4" />
      <p className="text-micro settings-muted mb-4 -mt-2">7-day goal hit rate per category</p>
      {trends.length === 0 ? (
        <EmptyState title="No category goals" description="Set daily goals on categories in Settings to track trends." />
      ) : (
        <ul className="space-y-3">
          {trends.map(t => (
            <li key={t.name} className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-text-primary truncate">{t.name}</span>
                  <span className="text-muted font-mono">{t.hitDays}/{t.totalDays} days · {t.hitRate}%</span>
                </div>
                <div className="h-1.5 rounded-full surface-track overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${t.hitRate}%`, backgroundColor: t.color }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  )
})
