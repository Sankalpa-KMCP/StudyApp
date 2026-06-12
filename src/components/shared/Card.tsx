import { memo, useCallback, useRef, type HTMLAttributes, type ReactNode } from 'react'

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

export const Card = memo(function Card({
  variant = 'default',
  padding = 'md',
  interactive = false,
  className = '',
  children,
  onMouseMove,
  ...props
}: CardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current
    if (card && interactive && !card.closest('[data-reduce-effects="true"]')) {
      const rect = card.getBoundingClientRect()
      card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
      card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
    }
    onMouseMove?.(e)
  }, [interactive, onMouseMove])

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
})
