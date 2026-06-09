import { useSidebarCollapse } from './useSidebarCollapse'
import type { SidebarProps } from './types'
import { SidebarShell } from './SidebarShell'

export type { SidebarProps } from './types'

export function Sidebar(props: SidebarProps) {
  const { collapsed, transitioning, toggleCollapsed } = useSidebarCollapse()

  if (props.isZenMode) return null

  return (
    <SidebarShell
      {...props}
      collapsed={collapsed}
      transitioning={transitioning}
      onToggleCollapse={toggleCollapsed}
    />
  )
}
