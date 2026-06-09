import type { ActiveTab } from '../../types/app'
import { NavTabButton } from '../../navigation/NavTabButton'
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
  icon,
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

  return (
    <NavTabButton
      variant={variant === 'rail' ? 'sidebar-rail' : 'sidebar-expanded'}
      tabId={tabId}
      label={label}
      icon={icon}
      iconColor={iconColor}
      accent={accent}
      isActive={isActive}
      isLocked={isLocked}
      onClick={onClick}
      onMouseEnter={variant === 'rail' ? handleMouseEnter : undefined}
      onMouseLeave={variant === 'rail' ? handleMouseLeave : undefined}
    />
  )
}
