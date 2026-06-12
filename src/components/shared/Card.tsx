import { useRef, type HTMLAttributes, type ReactNode } from 'react'

type CardVariant = 'default' | 'elevated' | 'inset'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: 'none' | 'sm' | 'md' | 'lg'
  interactive?: boolean
  children: ReactNode
}

const paddingClass = {
  none: '',
  sm: 'p-4',
  md: 'p-5 md:p-6',
  lg: 'p-6 md:p-8',
} as const

function cardShellClass(variant: CardVariant, interactive: boolean): string {
  if (variant === 'inset') return 'glass-tier-2'
  const hoverClass = interactive ? 'dynamic-card-interactive' : 'dynamic-card-static'
  const shadow = variant === 'elevated' ? ' shadow-2xl' : ''
  return `${hoverClass}${shadow}`
}

export function Card({
  variant = 'default',
  padding = 'md',
  interactive = false,
  className = '',
  children,
  onMouseMove,
  ...props
}: CardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current
    if (card && interactive) {
      const rect = card.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      card.style.setProperty('--mouse-x', `${x}px`)
      card.style.setProperty('--mouse-y', `${y}px`)
    }
    if (onMouseMove) {
      onMouseMove(e)
    }
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`dynamic-card ${cardShellClass(variant, interactive)} ${paddingClass[padding]} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  )
}
