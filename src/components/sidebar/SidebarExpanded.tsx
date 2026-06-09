import { Brain, ChevronLeft, Flame, FileText, Sparkles, Keyboard } from 'lucide-react'
import type { ActiveTab } from '../../types/app'
import { NAV_TABS } from './constants'
import type { SidebarModeProps } from './types'
import { SidebarNavButton } from './SidebarNavButton'
import { SidebarActionButton } from './SidebarActionButton'

export function SidebarExpanded({
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
  onToggleCollapse,
}: SidebarModeProps) {
  const handleTabClick = (tabId: ActiveTab) => {
    setActiveTab(tabId)
  }

  return (
    <aside
      data-collapsed="false"
      className="sidebar-shell sidebar-shell--expanded glass-panel w-full shrink-0 overflow-hidden border-b md:border-b-0 md:border-r border-white/[0.08] md:m-4 md:mr-0 rounded-b-2xl md:rounded-[28px] p-4 md:p-6 flex flex-col justify-between gap-4 md:gap-6 z-30 shadow-2xl"
    >
      <div className="flex flex-col gap-4 md:gap-6">
        <div className="flex items-center gap-3 px-1 py-0.5 select-none">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-tr from-accent-blue to-accent-purple shadow-md shadow-accent-blue/10">
            <Brain className="h-5.5 w-5.5 text-white" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <h1 className="text-sm font-bold text-white tracking-wide leading-none whitespace-nowrap">Study Dashboard</h1>
            <p className="text-caption text-white/50 font-medium mt-1.5 leading-none whitespace-nowrap">by Sankalpa KMCP</p>
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/80 transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="hidden md:block dynamic-card space-y-3.5 select-none p-4">
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

        <nav className="hidden md:flex flex-col gap-1">
          {NAV_TABS.map(tab => {
            const isActive = activeTab === tab.id
            const isLocked = enforceLockout && isTimerActive && timerMode === 'study' && tab.id !== 'focus'
            return (
              <SidebarNavButton
                key={tab.id}
                variant="expanded"
                tabId={tab.id}
                label={tab.label}
                icon={tab.icon}
                iconColor={tab.color}
                isActive={isActive}
                isLocked={isLocked}
                onClick={() => handleTabClick(tab.id)}
              />
            )
          })}

          <SidebarActionButton
            variant="expanded"
            label="Quick Notes"
            icon={FileText}
            iconClassName="text-accent-blue"
            onClick={onToggleNotes}
          />
        </nav>
      </div>

      <div className="hidden md:flex flex-col border-t border-white/5 pt-4 gap-3.5 select-none">
        <SidebarActionButton
          variant="expanded"
          label="Getting Started Tour"
          icon={Sparkles}
          iconClassName="text-accent-blue"
          onClick={onShowOnboarding}
          compact
        />
        <SidebarActionButton
          variant="expanded"
          label="Keyboard Shortcuts"
          icon={Keyboard}
          iconClassName="text-white/40"
          onClick={() => setIsHotkeyHudOpen(true)}
          compact
        />
        <div className="text-center space-y-0.5">
          <p className="text-label text-white/30 font-mono">Study Dashboard Engine</p>
          <p className="text-label text-white/40 font-mono font-medium">Created by Sankalpa KMCP</p>
        </div>
      </div>
    </aside>
  )
}
