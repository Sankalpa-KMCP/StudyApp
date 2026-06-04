import React from 'react'
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
  { id: 'analytics', label: 'Stats', icon: BarChart3 },
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
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden items-center justify-around border-t border-white/10 bg-black/40 backdrop-blur-xl px-2 py-2 safe-area-pb"
      aria-label="Main navigation"
    >
      {TABS.map(tab => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        const isLocked = enforceLockout && isTimerActive && timerMode === 'study' && tab.id !== 'focus'
        return (
          <button
            key={tab.id}
            type="button"
            disabled={isLocked}
            aria-current={isActive ? 'page' : undefined}
            aria-label={tab.label}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue ${
              isActive ? 'text-white' : 'text-white/50'
            } ${isLocked ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Icon className={`h-5 w-5 ${isActive ? 'text-accent-blue' : ''}`} />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
