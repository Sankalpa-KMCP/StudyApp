import React, { useRef } from 'react'
import type { ActiveTab } from '../types/app'
import { getVisibleNavTabs } from '../navigation/appNav'
import { NavTabButton } from '../navigation/NavTabButton'
import { prefetchTabChunk } from '../lib/routing/prefetchTabChunks'

interface MobileTabBarProps {
  activeTab: ActiveTab
  setActiveTab: (tab: ActiveTab) => void
  isTimerActive: boolean
  timerMode: 'study' | 'break'
  enforceLockout: boolean
  cardsDueCount?: number
  flashcardsEnabled?: boolean
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  activeTab,
  setActiveTab,
  isTimerActive,
  timerMode,
  enforceLockout,
  cardsDueCount = 0,
  flashcardsEnabled = true,
}) => {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const handleTabClick = (tabId: ActiveTab) => (e: React.MouseEvent<HTMLButtonElement>) => {
    setActiveTab(tabId)
    if (e.detail === 0) {
      tabRefs.current[tabId]?.focus()
    }
  }

  return (
    <nav
      className="fixed bottom-4 left-4 right-4 z-30 flex md:hidden items-center justify-around glass-panel shadow-2xl px-2 py-2 safe-area-pb rounded-[22px] border border-white/10"
      aria-label="Main navigation"
    >
      {getVisibleNavTabs(!!flashcardsEnabled).map(tab => {
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
            badge={tab.id === 'cards' ? cardsDueCount : undefined}
            onClick={handleTabClick(tab.id)}
            onMouseEnter={() => prefetchTabChunk(tab.id)}
            onTouchStart={() => prefetchTabChunk(tab.id)}
            buttonRef={el => { tabRefs.current[tab.id] = el }}
          />
        )
      })}
    </nav>
  )
}
