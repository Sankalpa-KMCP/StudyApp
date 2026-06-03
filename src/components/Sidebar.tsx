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
    <aside className="w-full md:w-64 shrink-0 bg-white/[0.02] backdrop-blur-xl border-b md:border-b-0 md:border-r border-white/[0.06] p-4 md:p-6 flex flex-col justify-between gap-6 transition-all duration-300 z-20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
      <div className="flex flex-col gap-6">
        
        {/* Branding Logo */}
        <div className="flex items-center gap-3 px-2 py-1 select-none">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_16px_rgba(0,0,0,0.2)] animate-pulse-soft">
            <Brain className="h-5 w-5 text-accent-blue stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight uppercase text-gradient-accent">Study Dashboard</h1>
            <p className="text-[8px] text-white/40 font-bold tracking-widest font-mono uppercase mt-0.5">by Sankalpa KMCP</p>
          </div>
        </div>

        {/* Streak & Progression Panel */}
        <div className="dynamic-card p-4 space-y-3.5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),_0_12px_24px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500/10 border border-orange-500/20">
                <Flame className="h-3.5 w-3.5 text-orange-400" />
              </div>
              <span className="text-xs font-bold font-mono text-white/90">{currentStreak} Day Streak</span>
            </div>
            <span className="rounded-lg bg-white/10 border border-white/15 px-2 py-0.5 text-[9px] font-bold text-white font-mono tracking-wider shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
              LV. {level}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[9px] text-white/50 font-bold font-mono uppercase tracking-wider">
              <span>XP Progress</span>
              <span className="text-white">{Math.round(xpProgressPercent)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40 border border-white/5 p-[1px]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-blue via-accent-purple to-accent-amber transition-all duration-500 ease-out shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                style={{ width: `${xpProgressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
          {[
            { id: 'focus', label: 'Focus Sanctuary', icon: Clock },
            { id: 'cards', label: 'Recall Deck', icon: Layers },
            { id: 'analytics', label: 'Analytics Studio', icon: BarChart3 },
            { id: 'journal', label: 'Activity Ledger', icon: Calendar },
            { id: 'settings', label: 'Control Deck', icon: Settings },
          ].map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const isLocked = localEnforceLockout && isTimerActive && timerMode === 'study' && tab.id !== 'focus'
            return (
              <button
                key={tab.id}
                disabled={isLocked}
                onClick={() => setActiveTab(tab.id as any)}
                className={`nav-tab shrink-0 md:w-full w-auto rounded-xl transition-all duration-300 ease-out ${isActive ? 'bg-white/10 text-white font-medium border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' : 'text-white/60 hover:bg-white/5 hover:text-white'} ${isLocked ? 'opacity-30 cursor-not-allowed hover:bg-transparent' : 'cursor-pointer'}`}
                title={isLocked ? "Focus Lockout Active" : undefined}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
          
          <button
            onClick={onToggleNotes}
            className="nav-tab shrink-0 md:w-full w-auto rounded-xl text-white/60 hover:bg-white/5 hover:text-white transition-all duration-300 ease-out cursor-pointer"
          >
            <FileText className="h-4 w-4 text-accent-blue" />
            <span>Quick Notes</span>
          </button>
        </nav>
      </div>

      {/* Sidebar Footer / Keyboard trigger */}
      <div className="hidden md:flex flex-col gap-3 border-t border-white/5 pt-4">
        <button
          onClick={() => setIsHotkeyHudOpen(true)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-white/50 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
        >
          <Keyboard className="h-4 w-4" />
          <span>Keyboard Shortcuts</span>
        </button>
        <div className="text-center space-y-1">
          <p className="text-[9px] text-white/40 font-bold font-mono uppercase tracking-wider">
            Study Dashboard Engine v2.0
          </p>
          <p className="text-[8px] text-white/30 font-semibold font-mono uppercase tracking-widest">
            Created by Sankalpa KMCP
          </p>
        </div>
      </div>
    </aside>
  )
}
