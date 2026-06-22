import { createContext } from 'react'

export interface SidebarFlyoutContextValue {
  showFlyout: (label: string, anchor: HTMLElement) => void
  hideFlyout: () => void
}

export const SidebarFlyoutContext = createContext<SidebarFlyoutContextValue | null>(null)
