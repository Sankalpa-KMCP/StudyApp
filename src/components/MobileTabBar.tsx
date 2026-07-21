import { memo, useRef, useCallback } from 'react'
import type { ActiveTab } from '../types/app'
import { getNavTabs } from '../navigation/appNav'
import { NavTabButton } from '../navigation/NavTabButton'
import { prefetchTabChunk } from '../lib/routing/prefetchTabChunks'

interface MobileTabBarProps {
  activeTab: ActiveTab
  setActiveTab: (tab: ActiveTab) => void
  isTimerActive: boolean
  timerMode: 'study' | 'break'
  enforceLockout: boolean
  reviewDueCount?: number
  showBackupReminder?: boolean
}

export const MobileTabBar = memo(function MobileTabBar({
  activeTab,
  setActiveTab,
  isTimerActive,
  timerMode,
  enforceLockout,
  reviewDueCount = 0,
  showBackupReminder = false,
}: MobileTabBarProps) {
  const navTabs = getNavTabs()
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
      className="fixed inset-x-0 bottom-0 z-40 flex md:hidden items-center justify-around glass-panel shadow-2xl border-t border-card px-2 pt-2 safe-area-pb rounded-t-[var(--radius-chrome-xl)]"
      aria-label="Main navigation"
    >
      {navTabs.map(tab => {
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
            badge={tab.id === 'focus' ? reviewDueCount : undefined}
            showNotificationDot={tab.id === 'settings' && showBackupReminder}
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
