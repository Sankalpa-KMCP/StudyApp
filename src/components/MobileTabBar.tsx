import { memo, useRef, useCallback } from 'react'
import type { ActiveTab } from '../types/app'
import { NAV_TABS } from '../navigation/appNav'
import { NavTabButton } from '../navigation/NavTabButton'
import { prefetchTabChunk } from '../lib/routing/prefetchTabChunks'

interface MobileTabBarProps {
  activeTab: ActiveTab
  setActiveTab: (tab: ActiveTab) => void
  isTimerActive: boolean
  timerMode: 'study' | 'break'
  enforceLockout: boolean
}

export const MobileTabBar = memo(function MobileTabBar({
  activeTab,
  setActiveTab,
  isTimerActive,
  timerMode,
  enforceLockout,
}: MobileTabBarProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const activateTab = useCallback(
    (tabId: ActiveTab) => setActiveTab(tabId),
    [setActiveTab],
  )

  const handleTabClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const tabId = e.currentTarget.dataset.tab as ActiveTab | undefined
      if (!tabId) return
      activateTab(tabId)
      if (e.detail === 0) {
        tabRefs.current[tabId]?.focus()
      }
    },
    [activateTab],
  )

  const handlePrefetch = useCallback((tabId: ActiveTab) => {
    prefetchTabChunk(tabId)
  }, [])

  return (
    <nav
      className="fixed bottom-4 left-4 right-4 z-30 flex md:hidden items-center justify-around glass-panel shadow-2xl px-2 py-2 safe-area-pb rounded-[22px] border border-card"
      aria-label="Main navigation"
    >
      {NAV_TABS.map(tab => {
        const isActive = activeTab === tab.id
        const isLocked = enforceLockout && isTimerActive && timerMode === 'study' && tab.id !== 'focus'
        return (
          <NavTabButton
            key={tab.id}
            variant="mobile"
            tabId={tab.id}
            label={tab.label}
            icon={tab.icon}
            iconColor={tab.color}
            accent={tab.accent}
            isActive={isActive}
            isLocked={isLocked}
            onClick={handleTabClick}
            onMouseEnter={() => handlePrefetch(tab.id)}
            onTouchStart={() => handlePrefetch(tab.id)}
            buttonRef={el => { tabRefs.current[tab.id] = el }}
          />
        )
      })}
    </nav>
  )
})
