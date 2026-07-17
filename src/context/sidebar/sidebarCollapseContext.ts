import { createContext, useContext } from 'react'
import type { useSidebarCollapse } from '../../hooks/sidebar/useSidebarCollapse'

export type SidebarCollapseContextValue = ReturnType<typeof useSidebarCollapse>

export const SidebarCollapseContext = createContext<SidebarCollapseContextValue | null>(null)

export function useSidebarCollapseContext() {
  const ctx = useContext(SidebarCollapseContext)
  if (!ctx) {
    throw new Error('useSidebarCollapseContext must be used within SidebarCollapseProvider')
  }
  return ctx
}

export function useOptionalSidebarCollapse() {
  return useContext(SidebarCollapseContext)
}
