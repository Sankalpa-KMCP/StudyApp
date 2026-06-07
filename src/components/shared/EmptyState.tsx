import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-[var(--radius-panel)] border border-dashed border-white/10 bg-white/[0.02]">
      {icon && <div className="mb-3 text-white/30">{icon}</div>}
      <p className="text-caption font-semibold text-white/80">{title}</p>
      {description && <p className="text-label text-white/45 mt-1.5 max-w-xs">{description}</p>}
    </div>
  )
}
