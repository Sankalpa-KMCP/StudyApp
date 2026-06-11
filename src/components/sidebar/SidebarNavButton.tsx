import type { ActiveTab } from '../../types/app'
import { NavTabButton } from '../../navigation/NavTabButton'
import { useSidebarFlyout } from './useSidebarFlyout'
import { prefetchControlDeck } from '../../lib/prefetchControlDeck'

interface SidebarNavButtonProps {
  variant: 'expanded' | 'rail'
  tabId: ActiveTab
  label: string
  icon: React.FC<{ className?: string }>
  iconColor: string
  accent: ActiveTab
  isActive: boolean
  isLocked: boolean
  badge?: number
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
  badge,
  onClick,
}: SidebarNavButtonProps) {
  const flyout = useSidebarFlyout()

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (tabId === 'settings') prefetchControlDeck()
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
      badge={badge}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={variant === 'rail' ? handleMouseLeave : undefined}
    />
  )
}
