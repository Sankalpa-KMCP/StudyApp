import type { ActiveTab } from '../../types/app'

export interface SidebarProps {
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
  cardsDueCount?: number
  flashcardsEnabled?: boolean
  onToggleNotes: () => void
  onShowOnboarding: () => void
}

export interface SidebarModeProps extends SidebarProps {
  onToggleCollapse: () => void
}
