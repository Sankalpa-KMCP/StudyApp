import { memo } from 'react'

export interface PieChartLegendItem {
  name: string
  color: string
  value: number
  percentage?: number
  emoji?: string
  unit?: string
}

interface PieChartLegendProps {
  items: PieChartLegendItem[]
  className?: string
}

export const PieChartLegend = memo(function PieChartLegend({ items, className = '' }: PieChartLegendProps) {
  return (
    <div className={`flex flex-col gap-2 flex-1 max-w-[150px] ${className}`}>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 text-micro font-semibold">
          {item.emoji ? (
            <span className="text-xs shrink-0">{item.emoji}</span>
          ) : (
            <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          )}
          <span className="text-primary flex-1 truncate">{item.name}</span>
          <span className="text-secondary font-mono">
            {item.value}
            {item.unit ?? ''}
          </span>
          {item.percentage !== undefined && (
            <span className="text-muted font-mono text-micro">({item.percentage}%)</span>
          )}
        </div>
      ))}
    </div>
  )
})
