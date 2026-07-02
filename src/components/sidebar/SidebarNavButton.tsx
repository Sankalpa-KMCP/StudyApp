import { memo, useCallback } from 'react'
import type { ActiveTab } from '../../types/app'
import { NavTabButton } from '../../navigation/NavTabButton'
import { useSidebarFlyout } from './useSidebarFlyout'
import { prefetchTabChunk } from '../../lib/routing/prefetchTabChunks'

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
  onActivate: (tabId: ActiveTab) => void
}

export const SidebarNavButton = memo(function SidebarNavButton({
  variant,
  tabId,
  label,
  icon,
  iconColor,
  accent,
  isActive,
  isLocked,
  badge,
  onActivate,
}: SidebarNavButtonProps) {
  const flyout = useSidebarFlyout()

  const handleClick = useCallback(() => {
    onActivate(tabId)
  }, [onActivate, tabId])

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      prefetchTabChunk(tabId)
      if (variant === 'rail') flyout.showFlyout(label, e.currentTarget)
    },
    [tabId, variant, label, flyout],
  )

  const handleMouseLeave = useCallback(() => {
    if (variant === 'rail') flyout.hideFlyout()
  }, [variant, flyout])

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
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={variant === 'rail' ? handleMouseLeave : undefined}
    />
  )
})
