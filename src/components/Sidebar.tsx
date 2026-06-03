import React from 'react'
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
  localEnforceLockout: boolean
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
  localEnforceLockout,
  onToggleNotes
}) => {
  if (isZenMode) return null

  return (
    <aside className="w-full md:w-64 shrink-0 bg-white/[0.015] backdrop-blur-3xl border-b md:border-b-0 md:border-r border-white/[0.08] p-5 md:p-6 flex flex-col justify-between gap-6 transition-all duration-500 z-20 shadow-[inset_-1px_0_0_rgba(255,255,255,0.05),_0_20px_50px_rgba(0,0,0,0.3)]">
      <div className="flex flex-col gap-6">
        
        {/* Branding Logo - Glowing visionOS Header */}
        <div className="flex items-center gap-3.5 px-2 py-1 select-none">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_8px_20px_rgba(0,0,0,0.4)]">
            {/* Ambient Backglow element */}
            <div className="absolute inset-0.5 rounded-2xl bg-gradient-to-tr from-accent-blue/30 to-accent-purple/30 blur-sm -z-10 animate-pulse-soft" />
            <Brain className="h-5.5 w-5.5 text-accent-blue stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xs font-black uppercase tracking-widest text-gradient-accent leading-none">Chronos</h1>
            <p className="text-[9px] text-white/50 font-mono tracking-widest uppercase mt-1">SANKALPA ENGINE</p>
          </div>
        </div>

        {/* Progression & Streak Panel (Redesigned Game Card style) */}
        <div className="dynamic-card p-4 space-y-4 bg-gradient-to-br from-white/[0.04] to-white/[0.005] border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),_0_16px_32px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-7.5 w-7.5 items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/25 shadow-[0_2px_8px_rgba(249,115,22,0.15)]">
                <Flame className="h-4.5 w-4.5 text-orange-400 animate-pulse" />
              </div>
              <span className="text-xs font-extrabold font-mono text-white/95">{currentStreak} Day Streak</span>
            </div>
            <span className="rounded-full bg-gradient-to-r from-accent-purple/20 to-accent-blue/20 border border-white/10 px-2.5 py-0.5 text-[8px] font-mono font-black text-white tracking-widest shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
              LVL {level}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[8px] text-white/40 font-mono font-black uppercase tracking-widest">
              <span>Experience Pool</span>
              <span className="text-white font-bold">{Math.round(xpProgressPercent)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/55 border border-white/5 p-[2px]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-blue via-accent-purple to-accent-amber transition-all duration-750 ease-out shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                style={{ width: `${xpProgressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Navigation Tabs (Frost-glass options) */}
        <nav className="flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
          {[
            { id: 'focus', label: 'Focus Sanctuary', icon: Clock, color: 'text-accent-blue' },
            { id: 'cards', label: 'Recall Deck', icon: Layers, color: 'text-accent-purple' },
            { id: 'analytics', label: 'Analytics Studio', icon: BarChart3, color: 'text-accent-green' },
            { id: 'journal', label: 'Activity Ledger', icon: Calendar, color: 'text-accent-amber' },
            { id: 'settings', label: 'Control Deck', icon: Settings, color: 'text-slate-400' },
          ].map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const isLocked = localEnforceLockout && isTimerActive && timerMode === 'study' && tab.id !== 'focus'
            return (
              <button
                key={tab.id}
                disabled={isLocked}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-auto shrink-0 md:w-full flex items-center gap-3.5 px-4 py-3 rounded-xl border font-bold text-xs transition-all duration-300 ease-out ${
                  isActive 
                    ? 'bg-white/[0.07] border-white/15 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_8px_16px_-4px_rgba(0,0,0,0.3)] scale-[1.02]' 
                    : 'bg-transparent border-transparent text-white/50 hover:bg-white/[0.03] hover:text-white hover:translate-x-1.5'
                } ${isLocked ? 'opacity-20 cursor-not-allowed hover:bg-transparent hover:translate-x-0' : 'cursor-pointer'}`}
                title={isLocked ? "Focus Lockout Active" : undefined}
              >
                <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? tab.color : 'text-white/40'}`} />
                <span>{tab.label}</span>
              </button>
            )
          })}
          
          <button
            onClick={onToggleNotes}
            className="w-auto shrink-0 md:w-full flex items-center gap-3.5 px-4 py-3 rounded-xl border border-transparent bg-transparent text-white/50 hover:bg-white/[0.03] hover:text-white hover:translate-x-1.5 transition-all duration-300 ease-out cursor-pointer"
          >
            <FileText className="h-4.5 w-4.5 text-accent-blue/80 shrink-0" />
            <span>Quick Notes</span>
          </button>
        </nav>
      </div>

      {/* Sidebar Footer / Keyboard trigger */}
      <div className="hidden md:flex flex-col gap-3.5 border-t border-white/5 pt-4">
        <button
          onClick={() => setIsHotkeyHudOpen(true)}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-white/40 hover:bg-white/5 hover:text-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all duration-300 cursor-pointer"
        >
          <Keyboard className="h-4 w-4 text-white/30" />
          <span>Keyboard Shortcuts</span>
        </button>
        <div className="text-center space-y-1 select-none">
          <p className="text-[8px] text-white/30 font-mono tracking-widest uppercase">
            Chronos Engine v3.0
          </p>
          <p className="text-[7.5px] text-white/20 font-bold font-mono tracking-wider uppercase">
            by Sankalpa KMCP
          </p>
        </div>
      </div>
    </aside>
  )
}
