import { createContext, useContext } from 'react'

export interface SidebarFlyoutContextValue {
  showFlyout: (label: string, anchor: HTMLElement) => void
  hideFlyout: () => void
}

export const SidebarFlyoutContext = createContext<SidebarFlyoutContextValue | null>(null)

const noopFlyout: SidebarFlyoutContextValue = {
  showFlyout: () => {},
  hideFlyout: () => {},
}

export function useSidebarFlyout() {
  const ctx = useContext(SidebarFlyoutContext)
  return ctx ?? noopFlyout
}
