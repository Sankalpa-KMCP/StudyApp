import { memo } from 'react'
import { PanelCard } from '../shared/PanelCard'
import { PanelHeader } from '../shared/PanelHeader'
import { EmptyState } from '../shared/EmptyState'
import { useTranslation } from '../../i18n/useTranslation'

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
  const { t } = useTranslation()

  return (
    <PanelCard>
      <PanelHeader title={t('analyticsCategoryGoalTrends')} bordered={false} className="mb-4" />
      <p className="text-micro settings-muted mb-4 -mt-2">{t('analyticsCategoryGoalHelper')}</p>
      {trends.length === 0 ? (
        <EmptyState title={t('analyticsNoCategoryGoalsTitle')} description={t('analyticsNoCategoryGoalsDesc')} />
      ) : (
        <ul className="space-y-3">
          {trends.map(trend => (
            <li key={trend.name} className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: trend.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-text-primary truncate">{trend.name}</span>
                  <span className="text-muted font-mono">
                    {t('analyticsCategoryGoalDays', { hit: trend.hitDays, total: trend.totalDays, rate: trend.hitRate })}
                  </span>
                </div>
                <div className="h-1.5 rounded-full surface-track overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${trend.hitRate}%`, backgroundColor: trend.color }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  )
})
