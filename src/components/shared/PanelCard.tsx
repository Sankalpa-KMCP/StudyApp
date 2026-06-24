import { memo, type HTMLAttributes, type ReactNode } from 'react'
import { Card } from './Card'

interface PanelCardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  children: ReactNode
}

export const PanelCard = memo(function PanelCard({ children, className = '', interactive = false, ...props }: PanelCardProps) {
  return (
    <Card variant="elevated" padding="md" interactive={interactive} className={`min-h-0 ${className}`.trim()} {...props}>
      {children}
    </Card>
  )
})
