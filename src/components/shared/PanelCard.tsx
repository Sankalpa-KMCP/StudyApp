import type { HTMLAttributes, ReactNode } from 'react'
import { Card } from './Card'

interface PanelCardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  children: ReactNode
}

export function PanelCard({ children, className = '', interactive = false, ...props }: PanelCardProps) {
  return (
    <Card variant="elevated" padding="md" interactive={interactive} className={className} {...props}>
      {children}
    </Card>
  )
}
