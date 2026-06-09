import { Brain, ChevronRight, FileText, Sparkles, Keyboard } from 'lucide-react'
import type { ActiveTab } from '../../types/app'
import { NAV_TABS } from './constants'
import type { SidebarModeProps } from './types'
import { SidebarFlyoutProvider } from './SidebarFlyout'
import { SidebarNavButton } from './SidebarNavButton'
import { SidebarActionButton } from './SidebarActionButton'

export function SidebarRail({
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
    <SidebarFlyoutProvider>
      <aside
        data-collapsed="true"
        className="sidebar-shell sidebar-shell--rail glass-panel w-full shrink-0 overflow-hidden border-b md:border-b-0 md:border-r border-white/[0.08] md:m-4 md:mr-0 rounded-b-2xl md:rounded-[28px] p-4 md:p-3 flex flex-col justify-between gap-4 md:gap-6 z-30 shadow-2xl"
      >
        <div className="flex flex-col gap-4 md:gap-6">
          <header className="grid justify-items-center gap-2 px-1 py-0.5 select-none">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-tr from-accent-blue to-accent-purple shadow-md shadow-accent-blue/10">
              <Brain className="h-5.5 w-5.5 text-white" />
            </div>
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/80 transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </header>

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
      </aside>
    </SidebarFlyoutProvider>
  )
}
