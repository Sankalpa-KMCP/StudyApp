import type { SidebarModeProps } from './types'
import { SidebarFlyoutProvider } from './SidebarFlyout'
import { SidebarExpandedContent } from './SidebarExpanded'
import { SidebarRailContent } from './SidebarRail'

interface SidebarShellProps extends SidebarModeProps {
  collapsed: boolean
  transitioning: boolean
}

export function SidebarShell({ collapsed, transitioning, ...modeProps }: SidebarShellProps) {
  const contentClass = [
    'sidebar-content',
    collapsed ? 'sidebar-content--rail' : 'sidebar-content--expanded',
    transitioning ? 'sidebar-content--transitioning' : '',
  ].filter(Boolean).join(' ')

  return (
    <aside
      data-collapsed={collapsed}
      className={`sidebar-shell glass-panel w-full shrink-0 overflow-hidden border-b md:border-b-0 md:border-r border-white/[0.08] md:m-4 md:mr-0 rounded-b-2xl md:rounded-[28px] p-4 z-30 shadow-2xl flex flex-col ${
        collapsed ? 'sidebar-shell--rail md:p-3' : 'sidebar-shell--expanded md:p-6'
      }`}
    >
      <div className={contentClass}>
        {collapsed ? (
          <SidebarFlyoutProvider>
            <SidebarRailContent {...modeProps} />
          </SidebarFlyoutProvider>
        ) : (
          <SidebarExpandedContent {...modeProps} />
        )}
      </div>
    </aside>
  )
}
