import { memo, useId, type ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
  /** Drops the inner bordered shell so content floats in the parent card */
  borderless?: boolean
}

export const EmptyState = memo(function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  borderless = false,
}: EmptyStateProps) {
  const titleId = useId()

  const shellClass = borderless
    ? compact ? 'py-8 px-4' : 'py-10 px-4 flex-1'
    : `empty-state-shell rounded-[var(--radius-panel)] border ${compact ? 'py-8 px-4' : 'py-12 px-6'}`

  return (
    <div
      role="status"
      aria-labelledby={titleId}
      className={`flex flex-col items-center justify-center text-center ${shellClass}`}
    >
      {icon && (
        <span aria-hidden className={`inline-flex text-muted opacity-60 ${compact ? 'mb-2' : 'mb-3'}`}>
          {icon}
        </span>
      )}
      <p id={titleId} className="text-title text-secondary">{title}</p>
      {description && <p className="text-label text-muted mt-1.5 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
})
