import { Flame, FileText, Sparkles, Keyboard } from 'lucide-react'
import type { ActiveTab } from '../../types/app'
import { NAV_TABS } from './constants'
import type { SidebarModeProps } from './types'
import { SidebarHeader } from './SidebarHeader'
import { SidebarNavButton } from './SidebarNavButton'
import { SidebarActionButton } from './SidebarActionButton'

export function SidebarExpandedContent({
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
    <div className="flex flex-col justify-between gap-4 md:gap-6 h-full min-h-0">
      <div className="flex flex-col gap-4 md:gap-6">
        <SidebarHeader collapsed={false} onToggleCollapse={onToggleCollapse} />

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
                accent={tab.accent}
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
    </div>
  )
}
