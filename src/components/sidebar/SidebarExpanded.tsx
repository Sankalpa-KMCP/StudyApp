import { Flame, FileText, Sparkles, Keyboard } from 'lucide-react'
import type { ActiveTab } from '../../types/app'
import { getVisibleNavTabs } from './constants'
import type { SidebarModeProps } from './types'
import { SidebarHeader } from './SidebarHeader'
import { SidebarNavButton } from './SidebarNavButton'
import { SidebarActionButton } from './SidebarActionButton'
import { QUICK_NOTES_HELPER } from '../../lib/shared/uxTerms'

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
  cardsDueCount = 0,
  flashcardsEnabled = true,
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

        <div className="hidden md:block dynamic-card-static sidebar-stats-card space-y-3.5 select-none p-4 animate-slide-in-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-accent-amber" />
              <span className="text-xs font-semibold text-primary">{currentStreak} day streak</span>
            </div>
            <span className="header-stat-chip !py-0.5 !px-2">
              LVL {level}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between panel-title">
              <span>XP progress</span>
              <span>{Math.round(xpProgressPercent)}%</span>
            </div>
            <div className="h-2 w-full rounded-full surface-track overflow-hidden">
              <div
                className="h-full xp-bar-fill rounded-full transition-all duration-500 ease-out"
                style={{ width: `${xpProgressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <p className="hidden md:block px-1 text-label font-bold uppercase tracking-wider text-muted select-none">Workspace</p>
        <nav className="hidden md:flex flex-col gap-1">
          {getVisibleNavTabs(!!flashcardsEnabled).map(tab => {
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
                badge={tab.id === 'cards' ? cardsDueCount : undefined}
                onClick={() => handleTabClick(tab.id)}
              />
            )
          })}

          <p className="hidden md:block px-1 pt-2 text-label font-bold uppercase tracking-wider text-muted select-none">Tools</p>
          <SidebarActionButton
            variant="expanded"
            label="Quick Notes"
            subtitle={QUICK_NOTES_HELPER}
            icon={FileText}
            iconClassName="text-accent-blue"
            onClick={onToggleNotes}
          />
        </nav>
      </div>

      <div className="hidden md:flex flex-col border-t border-card pt-4 gap-3.5 select-none">
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
          iconClassName="text-muted"
          onClick={() => setIsHotkeyHudOpen(true)}
          compact
        />
        <div className="text-center space-y-0.5">
          <p className="text-label text-muted font-mono">Study Dashboard Engine</p>
          <p className="text-label text-secondary font-mono font-medium">Created by Sankalpa KMCP</p>
        </div>
      </div>
    </div>
  )
}
