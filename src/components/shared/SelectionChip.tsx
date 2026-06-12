import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'

export type ChipAccent = 'blue' | 'amber' | 'green' | 'purple' | 'neutral' | 'red'

const ACCENT_SELECTED: Record<ChipAccent, string> = {
  blue: 'bg-accent-blue/15 border-accent-blue/35 text-accent-blue',
  amber: 'bg-accent-amber/15 border-accent-amber/35 text-accent-amber',
  green: 'bg-accent-green/15 border-accent-green/35 text-accent-green',
  purple: 'bg-accent-purple/15 border-accent-purple/35 text-accent-purple',
  neutral: 'surface-subtle border-card text-primary',
  red: 'bg-red-500/15 border-red-500/35 text-red-400',
}

interface SelectionChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean
  accent?: ChipAccent
  accentColor?: string
  children: ReactNode
  size?: 'sm' | 'md'
}

export function SelectionChip({
  selected,
  accent = 'blue',
  accentColor,
  children,
  size = 'md',
  className = '',
  type = 'button',
  style,
  ...props
}: SelectionChipProps) {
  const sizeClass = size === 'sm' ? 'px-2.5 py-1 text-micro' : 'px-4 py-2 text-caption'

  const selectedStyle: CSSProperties | undefined =
    selected && accentColor
      ? {
          backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
          borderColor: `color-mix(in srgb, ${accentColor} 35%, transparent)`,
          color: accentColor,
        }
      : undefined

  const stateClass = selected
    ? accentColor
      ? 'font-semibold border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
      : `${ACCENT_SELECTED[accent]} font-semibold border shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`
    : 'surface-subtle border-card text-muted hover:border-accent-blue/30 font-semibold border'

  return (
    <button
      type={type}
      className={`rounded-full transition-all ios-active-scale cursor-pointer ${sizeClass} ${stateClass} ${className}`.trim()}
      style={{ ...selectedStyle, ...style }}
      aria-pressed={selected}
      {...props}
    >
      {children}
    </button>
  )
}
