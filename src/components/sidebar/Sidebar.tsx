import { useSidebarCollapse } from './useSidebarCollapse'
import type { SidebarProps } from './types'
import { SidebarExpanded } from './SidebarExpanded'
import { SidebarRail } from './SidebarRail'

export type { SidebarProps } from './types'

export function Sidebar(props: SidebarProps) {
  const { collapsed, toggleCollapsed } = useSidebarCollapse()

  if (props.isZenMode) return null

  const modeProps = {
    ...props,
    onToggleCollapse: toggleCollapsed,
  }

  if (collapsed) {
    return <SidebarRail {...modeProps} />
  }

  return <SidebarExpanded {...modeProps} />
}
