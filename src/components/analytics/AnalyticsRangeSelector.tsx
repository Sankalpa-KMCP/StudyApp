import { memo, useCallback } from 'react'
import type { AnalyticsHistoryRange } from '../../hooks/useAnalyticsHistoryRange'
import { ANALYTICS_RANGE_LABELS } from '../../hooks/useAnalyticsHistoryRange'
import { SelectionChip } from '../shared/SelectionChip'

const RANGES: AnalyticsHistoryRange[] = ['7d', '30d', '90d', 'all']

interface AnalyticsRangeSelectorProps {
  range: AnalyticsHistoryRange
  onChange: (range: AnalyticsHistoryRange) => void
}

export const AnalyticsRangeSelector = memo(function AnalyticsRangeSelector({ range, onChange }: AnalyticsRangeSelectorProps) {
  const selectRange = useCallback((key: AnalyticsHistoryRange) => () => onChange(key), [onChange])

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4" role="group" aria-label="Analytics time range">
      <span className="text-micro font-semibold settings-muted mr-1">Productivity window</span>
      {RANGES.map(key => (
        <SelectionChip
          key={key}
          selected={range === key}
          accent="green"
          size="sm"
          onClick={selectRange(key)}
        >
          {ANALYTICS_RANGE_LABELS[key]}
        </SelectionChip>
      ))}
    </div>
  )
})
