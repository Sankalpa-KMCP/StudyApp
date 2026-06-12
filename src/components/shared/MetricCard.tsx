import type { FC } from 'react'
import { PanelCard } from './PanelCard'

interface MetricCardProps {
  label: string
  value: string
  icon?: FC<{ className?: string }>
  valueClassName?: string
}

export function MetricCard({ label, value, icon: Icon, valueClassName = '' }: MetricCardProps) {
  return (
    <PanelCard className="flex items-center justify-between">
      <div>
        <p className="panel-title">{label}</p>
        <p className={`text-2xl font-bold text-primary mt-1 font-mono tabular-nums ${valueClassName}`.trim()}>{value}</p>
      </div>
      {Icon && (
        <div className="h-11 w-11 rounded-full flex items-center justify-center border border-accent-blue/20 bg-accent-blue/8 shadow-inner shrink-0">
          <Icon className="h-5 w-5 text-accent-blue" />
        </div>
      )}
    </PanelCard>
  )
}
