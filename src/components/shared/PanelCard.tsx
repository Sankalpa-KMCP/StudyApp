import type { HTMLAttributes, ReactNode } from 'react'
import { Card } from './Card'

interface PanelCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function PanelCard({ children, className = '', ...props }: PanelCardProps) {
  return (
    <Card variant="elevated" padding="md" className={className} {...props}>
      {children}
    </Card>
  )
}
