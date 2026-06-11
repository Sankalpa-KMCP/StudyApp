import React, { useEffect, useRef } from 'react'
import { Clock, Layers, BarChart3, Calendar, Settings } from 'lucide-react'
import type { ActiveTab } from '../types/app'

interface MobileTabBarProps {
  activeTab: ActiveTab
  setActiveTab: (tab: ActiveTab) => void
  isTimerActive: boolean
  timerMode: 'study' | 'break'
  enforceLockout: boolean
}

const TABS: { id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'focus', label: 'Focus', icon: Clock },
  { id: 'cards', label: 'Cards', icon: Layers },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'journal', label: 'Journal', icon: Calendar },
  { id: 'settings', label: 'Settings', icon: Settings },
]

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
      {TABS.map(tab => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        const isLocked = enforceLockout && isTimerActive && timerMode === 'study' && tab.id !== 'focus'
        return (
          <button
            key={tab.id}
            ref={el => { tabRefs.current[tab.id] = el }}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            aria-label={tab.label}
            onClick={() => handleTabClick(tab.id)}
            className={`relative flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl text-label font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue ${
              isActive ? 'text-accent-blue' : 'text-white/50'
            } ${isLocked ? 'opacity-40' : 'cursor-pointer'}`}
          >
            {isActive && (
              <span className="absolute inset-0 rounded-xl bg-accent-blue/10 border border-accent-blue/20 pointer-events-none" />
            )}
            <Icon className={`relative z-10 h-5 w-5 ${isActive ? 'text-accent-blue' : ''}`} />
            <span className="relative z-10">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
