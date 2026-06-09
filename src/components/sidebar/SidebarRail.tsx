import { FileText, Sparkles, Keyboard } from 'lucide-react'
import type { ActiveTab } from '../../types/app'
import { NAV_TABS } from './constants'
import type { SidebarModeProps } from './types'
import { SidebarHeader } from './SidebarHeader'
import { SidebarNavButton } from './SidebarNavButton'
import { SidebarActionButton } from './SidebarActionButton'

export function SidebarRailContent({
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
        <SidebarHeader collapsed onToggleCollapse={onToggleCollapse} />

        <nav className="hidden md:grid justify-items-center gap-1">
          {NAV_TABS.map(tab => {
            const isActive = activeTab === tab.id
            const isLocked = enforceLockout && isTimerActive && timerMode === 'study' && tab.id !== 'focus'
            return (
              <SidebarNavButton
                key={tab.id}
                variant="rail"
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
            variant="rail"
            label="Quick Notes"
            icon={FileText}
            iconClassName="text-accent-blue"
            onClick={onToggleNotes}
          />
        </nav>
      </div>

      <footer className="hidden md:grid justify-items-center gap-2 border-t border-white/5 pt-4 select-none">
        <SidebarActionButton
          variant="rail"
          label="Getting Started Tour"
          icon={Sparkles}
          iconClassName="text-accent-blue"
          onClick={onShowOnboarding}
        />
        <SidebarActionButton
          variant="rail"
          label="Keyboard Shortcuts"
          icon={Keyboard}
          iconClassName="text-white/40"
          onClick={() => setIsHotkeyHudOpen(true)}
        />
      </footer>
    </div>
  )
}
