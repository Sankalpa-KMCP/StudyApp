import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-accent-blue text-on-accent border border-accent-blue/30 hover:bg-accent-blue/90 shadow-md shadow-accent-blue/15',
  secondary: 'surface-subtle text-secondary border border-card hover:surface-track',
  ghost: 'bg-transparent text-muted border border-transparent hover:surface-subtle hover:text-primary',
  danger: 'bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-label',
  md: 'px-4 py-2 text-caption font-semibold',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-full transition-all ios-active-scale cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue disabled:opacity-40 disabled:pointer-events-none ${variantClass[variant]} ${sizeClass[size]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}
