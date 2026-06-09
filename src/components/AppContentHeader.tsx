import { Brain, Flame } from 'lucide-react'
import type { ActiveTab } from '../types/app'
import { TAB_CHROME } from '../navigation/appNav'

interface AppContentHeaderProps {
  activeTab: ActiveTab
  currentStreak: number
  isTimerActive: boolean
  timerMode: 'study' | 'break'
}

export function AppContentHeader({
  activeTab,
  currentStreak,
  isTimerActive,
  timerMode,
}: AppContentHeaderProps) {
  return (
    <>
      <header className="flex md:hidden items-center justify-between px-4 py-2.5 border-b border-white/5 bg-black/10 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent-blue" />
          <span className="font-bold text-sm text-white">Study Dashboard</span>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-1">
          <Flame className="h-3.5 w-3.5 text-accent-amber" />
          <span className="text-label font-mono font-bold text-accent-amber">{currentStreak}d</span>
        </div>
      </header>

      <header className="hidden md:flex items-center justify-between px-6 lg:px-8 py-4 border-b border-white/5 bg-black/10 backdrop-blur-md">
        <div className="select-none">
          <h2 className="text-base font-bold text-white tracking-wide">{TAB_CHROME[activeTab].title}</h2>
          <p className="text-caption text-white/45 font-medium mt-1">{TAB_CHROME[activeTab].subtitle}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1.5">
            <Flame className="h-3.5 w-3.5 text-accent-amber" />
            <span className="text-label font-mono font-bold text-accent-amber">{currentStreak} day streak</span>
          </div>
          {isTimerActive && (
            <div className="flex items-center gap-1.5 rounded-full bg-accent-blue/10 border border-accent-blue/20 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-blue animate-pulse" />
              <span className="text-label font-semibold text-accent-blue">
                {timerMode === 'study' ? 'Study timer running' : 'Break timer running'}
              </span>
            </div>
          )}
        </div>
      </header>
    </>
  )
}
