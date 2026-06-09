import type { ActiveTab } from '../../types/app'
import { useSidebarFlyout } from './useSidebarFlyout'

interface SidebarNavButtonProps {
  variant: 'expanded' | 'rail'
  tabId: ActiveTab
  label: string
  icon: React.FC<{ className?: string }>
  iconColor: string
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
        aria-current={isActive ? 'page' : undefined}
        aria-label={label}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`h-10 w-10 flex items-center justify-center rounded-[14px] font-semibold text-xs transition-colors duration-200 ios-active-scale border ${
          isActive
            ? 'bg-accent-blue/12 border-accent-blue/25 shadow-sm text-white font-bold'
            : 'border-transparent bg-transparent text-white/60 hover:bg-white/[0.06] hover:text-white'
        } ${isLocked ? 'opacity-40' : 'cursor-pointer'}`}
      >
        <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? iconColor : 'text-white/60'}`} />
      </button>
    )
  }

  return (
    <button
      type="button"
      data-tab={tabId}
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
      title={isLocked ? 'Focus lockout active' : label}
      onClick={onClick}
      className={`nav-tab w-full ios-active-scale ${isActive ? 'active' : ''} ${isLocked ? 'opacity-40' : 'cursor-pointer'}`}
    >
      <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? iconColor : 'text-white/60'}`} />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  )
}
