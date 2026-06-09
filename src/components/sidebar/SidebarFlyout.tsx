import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { SidebarFlyoutContext } from './useSidebarFlyout'

interface FlyoutState {
  label: string
  top: number
  left: number
}

export function SidebarFlyoutProvider({ children }: { children: React.ReactNode }) {
  const [flyout, setFlyout] = useState<FlyoutState | null>(null)

  const showFlyout = useCallback((label: string, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect()
    setFlyout({
      label,
      top: rect.top + rect.height / 2,
      left: rect.right + 8,
    })
  }, [])

  const hideFlyout = useCallback(() => setFlyout(null), [])

  return (
    <SidebarFlyoutContext.Provider value={{ showFlyout, hideFlyout }}>
      {children}
      {flyout && createPortal(
        <div
          className="sidebar-flyout sidebar-flyout-enter glass-panel px-2.5 py-1 rounded-lg text-xs font-semibold text-white/90 whitespace-nowrap shadow-lg pointer-events-none border-l-2 border-l-accent-blue/40"
          style={{
            position: 'fixed',
            top: flyout.top,
            left: flyout.left,
            zIndex: 50,
          }}
          aria-hidden="true"
        >
          {flyout.label}
        </div>,
        document.body,
      )}
    </SidebarFlyoutContext.Provider>
  )
}
