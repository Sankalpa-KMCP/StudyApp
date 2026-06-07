import type { HTMLAttributes, ReactNode } from 'react'

type CardVariant = 'default' | 'elevated' | 'inset'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: 'none' | 'sm' | 'md' | 'lg'
  children: ReactNode
}

const paddingClass = {
  none: '',
  sm: 'p-4',
  md: 'p-5 md:p-6',
  lg: 'p-6 md:p-8',
} as const

const variantClass: Record<CardVariant, string> = {
  default: 'dynamic-card',
  elevated: 'dynamic-card shadow-2xl',
  inset: 'glass-tier-2',
}

export function Card({
  variant = 'default',
  padding = 'md',
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <div className={`${variantClass[variant]} ${paddingClass[padding]} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
