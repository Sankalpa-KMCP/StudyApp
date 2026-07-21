import { memo, type ButtonHTMLAttributes, type ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-accent-blue text-on-accent border border-accent-blue/35 hover:bg-accent-blue/90 shadow-md shadow-accent-blue/20 [box-shadow:inset_0_1px_0_color-mix(in_srgb,var(--color-text-primary)_18%,transparent),0_8px_24px_color-mix(in_srgb,var(--color-accent-blue)_25%,transparent)] hover:[box-shadow:inset_0_1px_0_color-mix(in_srgb,var(--color-text-primary)_22%,transparent),0_10px_28px_color-mix(in_srgb,var(--color-accent-blue)_30%,transparent)] focus-visible:outline-accent-blue focus-visible:outline-offset-2',
  secondary: 'surface-subtle text-secondary border border-card hover:border-accent-blue/25 hover:surface-track hover:text-primary',
  ghost: 'bg-transparent text-muted border border-transparent hover:surface-subtle hover:text-primary',
  danger: 'bg-danger-muted text-danger border border-danger hover:bg-[color-mix(in_srgb,var(--color-danger)_25%,transparent)] focus-visible:outline-danger focus-visible:outline-offset-2',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-label',
  md: 'px-4 py-2 text-caption font-semibold',
}

export const Button = memo(function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  const dangerFocusOverride = variant === 'danger' ? 'focus-visible:outline-danger' : 'focus-visible:outline-accent-blue'

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-full transition-all ios-active-scale cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${dangerFocusOverride} disabled:opacity-40 disabled:pointer-events-none ${variantClass[variant]} ${sizeClass[size]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
})
