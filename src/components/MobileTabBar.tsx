import React, { useEffect, useRef } from 'react'
import type { ActiveTab } from '../types/app'
import { NAV_TABS } from '../navigation/appNav'
import { NavTabButton } from '../navigation/NavTabButton'

interface MobileTabBarProps {
  activeTab: ActiveTab
  setActiveTab: (tab: ActiveTab) => void
  isTimerActive: boolean
  timerMode: 'study' | 'break'
  enforceLockout: boolean
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  activeTab,
  setActiveTab,
  isTimerActive,
  timerMode,
  enforceLockout,
}) => {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    tabRefs.current[activeTab]?.focus()
  }, [activeTab])

  const handleTabClick = (tabId: ActiveTab) => {
    setActiveTab(tabId)
  }

  return (
    <nav
      className="fixed bottom-4 left-4 right-4 z-30 flex md:hidden items-center justify-around glass-panel shadow-2xl px-2 py-2 safe-area-pb rounded-[22px] border border-white/10"
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
            onClick={() => handleTabClick(tab.id)}
            buttonRef={el => { tabRefs.current[tab.id] = el }}
          />
        )
      })}
    </nav>
  )
}
