import { memo, type FC } from 'react'
import { PanelCard } from './PanelCard'

type MetricAccent = 'blue' | 'green' | 'purple' | 'amber'

const ACCENT_WELL: Record<MetricAccent, { well: string; icon: string }> = {
  blue: { well: 'border-accent-blue/20 bg-accent-blue/8', icon: 'text-accent-blue' },
  green: { well: 'border-accent-green/20 bg-accent-green/8', icon: 'text-accent-green' },
  purple: { well: 'border-accent-purple/20 bg-accent-purple/8', icon: 'text-accent-purple' },
  amber: { well: 'border-accent-amber/20 bg-accent-amber/8', icon: 'text-accent-amber' },
}

interface MetricCardProps {
  label: string
  value: string
  icon?: FC<{ className?: string }>
  valueClassName?: string
  accent?: MetricAccent
}

export const MetricCard = memo(function MetricCard({ label, value, icon: Icon, valueClassName = '', accent = 'blue' }: MetricCardProps) {
  const accentClass = ACCENT_WELL[accent]
  return (
    <PanelCard className="flex items-center justify-between">
      <div>
        <p className="panel-title">{label}</p>
        <p className={`text-2xl font-bold text-primary mt-1 font-mono tabular-nums ${valueClassName}`.trim()}>{value}</p>
      </div>
      {Icon && (
        <div className={`h-11 w-11 rounded-full flex items-center justify-center border shadow-inner shrink-0 ${accentClass.well}`}>
          <Icon className={`h-5 w-5 ${accentClass.icon}`} />
        </div>
      )}
    </PanelCard>
  )
})
