import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
}

export function EmptyState({ icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div
      role="status"
      className={`empty-state-shell flex flex-col items-center justify-center text-center rounded-[var(--radius-panel)] border ${
        compact ? 'py-8 px-4' : 'py-12 px-6'
      }`}
    >
      {icon && <div className={`text-muted opacity-60 ${compact ? 'mb-2' : 'mb-3'}`}>{icon}</div>}
      <p className="text-title text-secondary">{title}</p>
      {description && <p className="text-label text-muted mt-1.5 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
