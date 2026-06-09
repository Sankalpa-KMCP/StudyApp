import type { ActiveTab } from '../../types/app'
import { useSidebarFlyout } from './useSidebarFlyout'

interface SidebarNavButtonProps {
  variant: 'expanded' | 'rail'
  tabId: ActiveTab
  label: string
  icon: React.FC<{ className?: string }>
  iconColor: string
  accent: ActiveTab
  isActive: boolean
  isLocked: boolean
  onClick: () => void
}

export function SidebarNavButton({
  variant,
  tabId,
  label,
  icon: Icon,
  iconColor,
  accent,
  isActive,
  isLocked,
  onClick,
}: SidebarNavButtonProps) {
  const flyout = useSidebarFlyout()

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (variant === 'rail') flyout.showFlyout(label, e.currentTarget)
  }

  const handleMouseLeave = () => {
    if (variant === 'rail') flyout.hideFlyout()
  }

  if (variant === 'rail') {
    return (
      <button
        type="button"
        data-tab={tabId}
        data-accent={accent}
        data-active={isActive ? 'true' : 'false'}
        aria-current={isActive ? 'page' : undefined}
        aria-label={label}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`sidebar-rail-btn h-10 w-10 flex items-center justify-center rounded-[14px] font-semibold text-xs transition-all duration-200 ios-active-scale border ${
          isLocked ? 'opacity-40' : 'cursor-pointer'
        }`}
      >
        <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? iconColor : 'text-white/60'}`} />
      </button>
    )
  }

  return (
    <button
      type="button"
      data-tab={tabId}
      data-accent={accent}
      data-active={isActive ? 'true' : 'false'}
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
      title={isLocked ? 'Focus lockout active' : label}
      onClick={onClick}
      className={`nav-tab w-full ios-active-scale ${isLocked ? 'opacity-40' : 'cursor-pointer'}`}
    >
      <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? iconColor : 'text-white/60'}`} />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  )
}
