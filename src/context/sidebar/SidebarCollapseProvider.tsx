import { useSidebarCollapse } from '../../hooks/sidebar/useSidebarCollapse'
import { SidebarCollapseContext } from './sidebarCollapseContext'

export function SidebarCollapseProvider({ children }: { children: React.ReactNode }) {
  const value = useSidebarCollapse()
  return (
    <SidebarCollapseContext.Provider value={value}>
      {children}
    </SidebarCollapseContext.Provider>
  )
}
