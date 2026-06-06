import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Brain, Clock, BarChart3, Calendar, Settings, Keyboard, Flame, Layers, FileText } from 'lucide-react'

interface SidebarProps {
  isZenMode: boolean
  currentStreak: number
  level: number
  xpProgressPercent: number
  activeTab: 'focus' | 'analytics' | 'journal' | 'cards' | 'settings'
  setActiveTab: (tab: 'focus' | 'analytics' | 'journal' | 'cards' | 'settings') => void
  setIsHotkeyHudOpen: (open: boolean) => void
  isTimerActive: boolean
  timerMode: 'study' | 'break'
  enforceLockout: boolean
  onToggleNotes: () => void
}

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
  onToggleNotes
}) => {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({
    opacity: 0,
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
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
        opacity: 1
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

  if (isZenMode) return null

  return (
    <aside className="w-full md:w-64 shrink-0 bg-white/[0.03] border-b md:border-b-0 md:border-r border-white/[0.08] md:m-4 md:mr-0 rounded-b-3xl md:rounded-[28px] p-5 md:p-6 flex flex-col justify-between gap-6 transition-all duration-300 z-20 shadow-2xl backdrop-blur-3xl">
      <div className="flex flex-col gap-6">
        
        {/* Branding Logo - iOS App Icon Header */}
        <div className="flex items-center gap-3 px-1 py-1 select-none">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-tr from-accent-blue to-accent-purple shadow-md shadow-accent-blue/10">
            <Brain className="h-5.5 w-5.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide leading-none">Study Dashboard</h1>
            <p className="text-[10px] text-white/50 font-medium mt-1.5 leading-none">by Sankalpa KMCP</p>
          </div>
        </div>

        {/* Progression & Streak Panel (iOS Widget Style) */}
        <div className="bg-black/20 border border-white/5 p-4 rounded-[20px] space-y-3.5 select-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-accent-amber" />
              <span className="text-xs font-semibold text-white">{currentStreak} Day Streak</span>
            </div>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[9px] font-bold text-white">
              LVL {level}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[8px] font-bold text-white/40 uppercase tracking-wider">
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

        {/* Navigation Tabs (iOS Widget Actions list) */}
        <nav className="relative flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
          {/* Background Gliding Indicator Pill */}
          <div 
            className="bg-white/10 border border-white/5 rounded-[14px] pointer-events-none" 
            style={indicatorStyle} 
          />

          {[
            { id: 'focus' as const, label: 'Focus Sanctuary', icon: Clock, color: 'text-accent-blue' },
            { id: 'cards' as const, label: 'Recall Deck', icon: Layers, color: 'text-accent-purple' },
            { id: 'analytics' as const, label: 'Analytics Studio', icon: 'text-[#30d158]' }, // system green hex
            { id: 'journal' as const, label: 'Activity Ledger', icon: Calendar, color: 'text-accent-amber' },
            { id: 'settings' as const, label: 'Control Deck', icon: Settings, color: 'text-white/60' },
          ].map(tab => {
            const Icon = typeof tab.icon === 'string' ? BarChart3 : tab.icon
            const isActive = activeTab === tab.id
            const isLocked = enforceLockout && isTimerActive && timerMode === 'study' && tab.id !== 'focus'
            const activeColorClass = tab.id === 'analytics' ? 'text-[#30d158]' : (tab.color || '')
            return (
              <button
                key={tab.id}
                ref={el => { tabRefs.current[tab.id] = el }}
                disabled={isLocked}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActiveTab(tab.id)}
                className={`relative z-10 w-auto shrink-0 md:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] font-semibold text-xs transition-colors duration-200 ios-active-scale bg-transparent border border-transparent ${
                  isActive 
                    ? 'text-white font-bold' 
                    : 'text-white/60 hover:text-white'
                } ${isLocked ? 'opacity-25 cursor-not-allowed hover:bg-transparent' : 'cursor-pointer'}`}
                title={isLocked ? "Focus Lockout Active" : undefined}
              >
                <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? activeColorClass : 'text-white/60'}`} />
                <span>{tab.label}</span>
              </button>
            )
          })}
          
          <button
            onClick={onToggleNotes}
            className="w-auto shrink-0 md:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] border border-transparent bg-transparent text-white/60 hover:bg-white/[0.04] hover:text-white transition-all duration-200 ios-active-scale cursor-pointer"
          >
            <FileText className="h-4.5 w-4.5 text-accent-blue shrink-0" />
            <span>Quick Notes</span>
          </button>
        </nav>
      </div>

      {/* Sidebar Footer / Keyboard trigger */}
      <div className="hidden md:flex flex-col gap-3.5 border-t border-white/5 pt-4 select-none">
        <button
          onClick={() => setIsHotkeyHudOpen(true)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/50 hover:bg-white/[0.04] hover:text-white transition-all duration-200 cursor-pointer"
        >
          <Keyboard className="h-4 w-4 text-white/40" />
          <span>Keyboard Shortcuts</span>
        </button>
        <div className="text-center space-y-0.5">
          <p className="text-[9px] text-white/30 font-mono">
            Study Dashboard Engine
          </p>
          <p className="text-[8px] text-white/40 font-mono font-medium">
            Created by Sankalpa KMCP
          </p>
        </div>
      </div>
    </aside>
  )
}
