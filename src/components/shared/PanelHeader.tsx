import type { ReactNode } from 'react'

interface PanelHeaderProps {
  title: string
  action?: ReactNode
  bordered?: boolean
  className?: string
  id?: string
}

export function PanelHeader({ title, action, bordered = true, className = '', id }: PanelHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between select-none ${
        bordered ? 'mb-5 border-b border-[var(--color-border-card)] pb-3' : 'mb-4'
      } ${className}`.trim()}
    >
      <span id={id} className="panel-title">{title}</span>
      {action}
    </div>
  )
}
