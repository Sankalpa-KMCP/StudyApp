import { memo } from 'react'
import { useSidebarFlyout } from './useSidebarFlyout'

interface SidebarActionButtonProps {
  variant: 'expanded' | 'rail'
  label: string
  subtitle?: string
  icon: React.FC<{ className?: string }>
  iconClassName?: string
  onClick: () => void
  compact?: boolean
}

export const SidebarActionButton = memo(function SidebarActionButton({
  variant,
  label,
  subtitle,
  icon: Icon,
  iconClassName = 'text-secondary',
  onClick,
  compact = false,
}: SidebarActionButtonProps) {
  const flyout = useSidebarFlyout()
  const flyoutText = subtitle ? `${label} — ${subtitle}` : label

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (variant === 'rail') flyout.showFlyout(flyoutText, e.currentTarget)
  }

  const handleMouseLeave = () => {
    if (variant === 'rail') flyout.hideFlyout()
  }

  if (variant === 'rail') {
    return (
      <button
        type="button"
        aria-label={flyoutText}
        title={flyoutText}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="sidebar-rail-btn h-10 w-10 flex items-center justify-center rounded-lg text-xs font-semibold text-muted hover:surface-subtle hover:text-primary transition-all duration-200 cursor-pointer"
      >
        <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} />
      </button>
    )
  }

  const sizeClass = compact
    ? 'gap-2.5 px-3 py-1.5 rounded-lg'
    : 'gap-3 px-3.5 py-2.5 rounded-[14px]'

  return (
    <button
      type="button"
      aria-label={flyoutText}
      title={flyoutText}
      onClick={onClick}
      className={`w-full flex items-center border border-transparent bg-transparent text-secondary hover:surface-subtle hover:text-primary transition-all duration-200 ios-active-scale cursor-pointer ${sizeClass}`}
    >
      <Icon className={`shrink-0 ${compact ? 'h-4 w-4' : 'h-4.5 w-4.5'} ${iconClassName}`} />
      <div className="flex flex-col items-start min-w-0 text-left">
        <span className="whitespace-nowrap">{label}</span>
        {subtitle && (
          <span className="text-micro font-medium text-muted normal-case tracking-normal leading-tight truncate max-w-full">
            {subtitle}
          </span>
        )}
      </div>
    </button>
  )
})
