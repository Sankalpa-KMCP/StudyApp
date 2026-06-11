import { useSidebarCollapse } from './useSidebarCollapse'
import { SidebarCollapseContext } from './useSidebarCollapseContext'

export function SidebarCollapseProvider({ children }: { children: React.ReactNode }) {
  const value = useSidebarCollapse()
  return (
    <SidebarCollapseContext.Provider value={value}>
      {children}
    </SidebarCollapseContext.Provider>
  )
}
