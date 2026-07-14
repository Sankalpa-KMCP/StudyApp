import { memo, useCallback } from 'react'
import type { AnalyticsHistoryRange } from '../../hooks/useAnalyticsHistoryRange'
import { getAnalyticsRangeLabel } from '../../hooks/useAnalyticsHistoryRange'
import { SelectionChip } from '../shared/SelectionChip'
import { useTranslation } from '../../i18n/useTranslation'

const RANGES: AnalyticsHistoryRange[] = ['7d', '30d', '90d', 'all']

interface AnalyticsRangeSelectorProps {
  range: AnalyticsHistoryRange
  onChange: (range: AnalyticsHistoryRange) => void
}

export const AnalyticsRangeSelector = memo(function AnalyticsRangeSelector({ range, onChange }: AnalyticsRangeSelectorProps) {
  const { t } = useTranslation()
  const selectRange = useCallback((key: AnalyticsHistoryRange) => () => onChange(key), [onChange])

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4" role="group" aria-label={t('analyticsProductivityWindow')}>
      <span className="text-micro font-semibold settings-muted mr-1">{t('analyticsProductivityWindow')}</span>
      {RANGES.map(key => (
        <SelectionChip
          key={key}
          selected={range === key}
          accent="green"
          size="sm"
          onClick={selectRange(key)}
        >
          {getAnalyticsRangeLabel(key)}
        </SelectionChip>
      ))}
    </div>
  )
})
