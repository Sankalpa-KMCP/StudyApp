import { memo, type ReactNode } from 'react'

interface PanelHeaderProps {
  title: string
  action?: ReactNode
  bordered?: boolean
  className?: string
  id?: string
  headingLevel?: 2 | 3 | 4
}

export const PanelHeader = memo(function PanelHeader({
  title,
  action,
  bordered = true,
  className = '',
  id,
  headingLevel = 2,
}: PanelHeaderProps) {
  const HeadingTag = `h${headingLevel}` as 'h2' | 'h3' | 'h4'

  return (
    <div
      className={`flex items-center justify-between select-none ${
        bordered ? 'mb-5 border-b border-card pb-3' : 'mb-4'
      } ${className}`.trim()}
    >
      <HeadingTag id={id} className="panel-title">{title}</HeadingTag>
      {action}
    </div>
  )
})
