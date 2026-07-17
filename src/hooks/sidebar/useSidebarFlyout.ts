import { useContext } from 'react'
import { SidebarFlyoutContext, type SidebarFlyoutContextValue } from '../../context/sidebar/sidebarFlyoutContext'

const noopFlyout: SidebarFlyoutContextValue = {
  showFlyout: () => {},
  hideFlyout: () => {},
}

export function useSidebarFlyout() {
  const ctx = useContext(SidebarFlyoutContext)
  return ctx ?? noopFlyout
}
