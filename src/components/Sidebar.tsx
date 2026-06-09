import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Brain, Clock, BarChart3, Calendar, Settings, Keyboard, Flame, Layers, FileText, Sparkles } from 'lucide-react'
import type { ActiveTab } from '../types/app'

interface SidebarProps {
  isZenMode: boolean
  currentStreak: number
  level: number
  xpProgressPercent: number
  activeTab: ActiveTab
  setActiveTab: (tab: ActiveTab) => void
  setIsHotkeyHudOpen: (open: boolean) => void
  isTimerActive: boolean
  timerMode: 'study' | 'break'
  enforceLockout: boolean
  onToggleNotes: () => void
  onShowOnboarding: () => void
}

const NAV_TABS: { id: ActiveTab; label: string; icon: React.FC<{ className?: string }>; color: string }[] = [
  { id: 'focus', label: 'Focus', icon: Clock, color: 'text-accent-blue' },
  { id: 'cards', label: 'Cards', icon: Layers, color: 'text-accent-purple' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, color: 'text-accent-green' },
  { id: 'journal', label: 'Journal', icon: Calendar, color: 'text-accent-amber' },
  { id: 'settings', label: 'Settings', icon: Settings, color: 'text-white/60' },
]

export const Sidebar: React.FC<SidebarProps> = ({
  isZenMode,
  currentStreak,
  level,
  xpProgressPercent,
  activeTab,
  setActiveTab,
  setIsHotkeyHudOpen,
  isTimerActive,
  timerMode,
  enforceLockout,
  onToggleNotes,
  onShowOnboarding,
}) => {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({
    opacity: 0,
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  })

  const updateIndicator = useCallback(() => {
    const activeBtn = tabRefs.current[activeTab]
    if (activeBtn) {
      setIndicatorStyle({
        position: 'absolute',
        left: `${activeBtn.offsetLeft}px`,
        top: `${activeBtn.offsetTop}px`,
        width: `${activeBtn.offsetWidth}px`,
        height: `${activeBtn.offsetHeight}px`,
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: 1,
      })
    }
  }, [activeTab])

  useEffect(() => {
    updateIndicator()
    const timer = setTimeout(updateIndicator, 50)
    window.addEventListener('resize', updateIndicator)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateIndicator)
    }
  }, [updateIndicator])

  useEffect(() => {
    tabRefs.current[activeTab]?.focus()
  }, [activeTab])

  const handleTabClick = (tabId: ActiveTab) => {
    setActiveTab(tabId)
  }

  if (isZenMode) return null

  return (
    <aside className="w-full md:w-64 shrink-0 bg-white/[0.03] border-b md:border-b-0 md:border-r border-white/[0.08] md:m-4 md:mr-0 rounded-b-2xl md:rounded-[28px] p-4 md:p-6 flex flex-col justify-between gap-4 md:gap-6 transition-all duration-300 z-20 shadow-2xl backdrop-blur-3xl">
      <div className="flex flex-col gap-4 md:gap-6">
        <div className="flex items-center gap-3 px-1 py-0.5 select-none">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-tr from-accent-blue to-accent-purple shadow-md shadow-accent-blue/10">
            <Brain className="h-5.5 w-5.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide leading-none">Study Dashboard</h1>
            <p className="text-caption text-white/50 font-medium mt-1.5 leading-none">by Sankalpa KMCP</p>
          </div>
        </div>

        <div className="hidden md:block bg-black/20 border border-white/5 p-4 rounded-[20px] space-y-3.5 select-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-accent-amber" />
              <span className="text-xs font-semibold text-white">{currentStreak} Day Streak</span>
            </div>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-label font-bold text-white">
              LVL {level}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-label font-bold text-white/40 uppercase tracking-wider">
              <span>XP Progress</span>
              <span>{Math.round(xpProgressPercent)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-accent-blue rounded-full transition-all duration-500 ease-out"
                style={{ width: `${xpProgressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <nav className="relative hidden md:flex flex-col gap-1">
          <div
            className="sidebar-indicator pointer-events-none"
            style={indicatorStyle}
          />

          {NAV_TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const isLocked = enforceLockout && isTimerActive && timerMode === 'study' && tab.id !== 'focus'
            return (
              <button
                key={tab.id}
                ref={el => { tabRefs.current[tab.id] = el }}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => handleTabClick(tab.id)}
                className={`relative z-10 w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] font-semibold text-xs transition-colors duration-200 ios-active-scale bg-transparent border border-transparent ${
                  isActive
                    ? 'text-white font-bold'
                    : 'text-white/60 hover:text-white'
                } ${isLocked ? 'opacity-40' : 'cursor-pointer'}`}
                title={isLocked ? 'Focus lockout active' : undefined}
              >
                <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? tab.color : 'text-white/60'}`} />
                <span>{tab.label}</span>
              </button>
            )
          })}

          <button
            onClick={onToggleNotes}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] border border-transparent bg-transparent text-white/60 hover:bg-white/[0.04] hover:text-white transition-all duration-200 ios-active-scale cursor-pointer"
          >
            <FileText className="h-4.5 w-4.5 text-accent-blue shrink-0" />
            <span>Quick Notes</span>
          </button>
        </nav>
      </div>

      <div className="hidden md:flex flex-col gap-3.5 border-t border-white/5 pt-4 select-none">
        <button
          onClick={onShowOnboarding}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/50 hover:bg-white/[0.04] hover:text-white transition-all duration-200 cursor-pointer"
        >
          <Sparkles className="h-4 w-4 text-accent-blue" />
          <span>Getting Started Tour</span>
        </button>
        <button
          onClick={() => setIsHotkeyHudOpen(true)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/50 hover:bg-white/[0.04] hover:text-white transition-all duration-200 cursor-pointer"
        >
          <Keyboard className="h-4 w-4 text-white/40" />
          <span>Keyboard Shortcuts</span>
        </button>
        <div className="text-center space-y-0.5">
          <p className="text-label text-white/30 font-mono">Study Dashboard Engine</p>
          <p className="text-label text-white/40 font-mono font-medium">Created by Sankalpa KMCP</p>
        </div>
      </div>
    </aside>
  )
}
