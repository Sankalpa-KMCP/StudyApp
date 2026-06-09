import type { SidebarProps } from './types'
import { SidebarShell } from './SidebarShell'
import { useSidebarCollapseContext } from './useSidebarCollapseContext'

export type { SidebarProps } from './types'

export function Sidebar(props: SidebarProps) {
  const { collapsed, transitioning, toggleCollapsed } = useSidebarCollapseContext()

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
