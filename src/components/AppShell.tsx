import { Brain, Flame, Keyboard } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { ZenOverlay } from './ZenOverlay'
import { ReflectionModal } from './ReflectionModal'
import { HotkeyModal } from './HotkeyModal'
import { QuickNotesDrawer } from './QuickNotesDrawer'
import { MobileTabBar } from './MobileTabBar'
import { FocusTab } from './tabs/FocusTab'
import { AnalyticsTab } from './tabs/AnalyticsTab'
import { JournalTab } from './tabs/JournalTab'
import { CardsTab } from './tabs/CardsTab'
import { SettingsTab } from './tabs/SettingsTab'
import { useStudyApp, useStudyUI } from '../context/useStudyApp'

export function AppShell() {
  const {
    isDataReady,
    canvasRef,
    tasks,
    settings,
    quickNotes,
    categories,
    timer,
    currentStreak,
    xpData,
    activeToast,
    isNotesOpen,
    setIsNotesOpen,
  } = useStudyApp()

  const {
    activeTab,
    setActiveTab,
    isZenMode,
    setIsZenMode,
    isHotkeyHudOpen,
    setIsHotkeyHudOpen,
    activeTaskId,
    activeThemeVars,
  } = useStudyUI()

  if (!isDataReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06070a]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-sm text-white/50 font-mono tracking-wider">LOADING STUDY DASHBOARD...</p>
        </div>
      </div>
    )
  }

  const inlineStyles = {
    '--color-surface': activeThemeVars.surface,
    '--color-surface-card': activeThemeVars.surfaceCard,
    '--color-accent-blue': activeThemeVars.accentBlue,
    '--color-accent-purple': activeThemeVars.accentPurple,
    '--color-accent-green': activeThemeVars.accentGreen,
    '--color-accent-amber': activeThemeVars.accentAmber,
    '--surface-card-rgb': activeThemeVars.surfaceCardRgb,
    '--card-opacity': settings.cardOpacity,
    '--backdrop-blur': `${settings.backdropBlur}px`,
  } as React.CSSProperties

  return (
    <div className="min-h-screen bg-transparent font-sans text-text-primary antialiased relative flex flex-col md:flex-row overflow-hidden pb-16 md:pb-0" style={inlineStyles}>
      <Sidebar
        isZenMode={isZenMode}
        currentStreak={currentStreak}
        level={xpData.level}
        xpProgressPercent={xpData.xpProgressPercent}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setIsHotkeyHudOpen={setIsHotkeyHudOpen}
        isTimerActive={timer.isTimerActive}
        timerMode={timer.timerMode}
        enforceLockout={settings.enforce_lockout}
        onToggleNotes={() => setIsNotesOpen(!isNotesOpen)}
      />

      <main className="flex-1 flex flex-col min-w-0 z-10">
        {!isZenMode && (
          <header className="flex md:hidden items-center justify-between px-4 py-3 border-b border-white/5 bg-black/10">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-white animate-pulse" />
                <span className="font-bold text-sm text-white">Study Dashboard</span>
              </div>
              <span className="text-[8px] text-white/40 font-mono tracking-widest font-bold">BY SANKALPA KMCP</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-xs font-mono font-bold text-orange-400">{currentStreak}d</span>
              </div>
              <button
                onClick={() => setIsHotkeyHudOpen(true)}
                aria-label="Keyboard shortcuts"
                className="p-1 rounded-lg hover:bg-white/5 text-slate-400 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue"
              >
                <Keyboard className="h-4 w-4" />
              </button>
            </div>
          </header>
        )}

        <div className={`flex-1 p-4 md:p-6 lg:p-8 flex flex-col transition-all duration-700 ${isZenMode ? 'opacity-0 scale-95 pointer-events-none' : ''}`}>
          {!isZenMode && (
            <div className="flex-1 flex flex-col min-h-0">
              {activeTab === 'focus' && <FocusTab />}
              {activeTab === 'analytics' && <AnalyticsTab />}
              {activeTab === 'journal' && <JournalTab />}
              {activeTab === 'cards' && <CardsTab />}
              {activeTab === 'settings' && <SettingsTab />}
            </div>
          )}
        </div>
      </main>

      <ZenOverlay
        isZenMode={isZenMode}
        canvasRef={canvasRef}
        remainingSeconds={timer.remainingSeconds}
        timerMode={timer.timerMode}
        sessionTasks={tasks.tasks}
        activeTaskId={activeTaskId}
        isTimerActive={timer.isTimerActive}
        setIsTimerActive={timer.setIsTimerActive}
        completeSession={timer.completeSession}
        enforceLockout={settings.enforce_lockout}
        setIsZenMode={setIsZenMode}
      />

      <ReflectionModal
        key={timer.pendingSessionData?.timestamp ?? 'reflection'}
        showReflectionModal={timer.showReflectionModal}
        pendingSessionData={timer.pendingSessionData}
        studyBlockDurationMinutes={settings.studyBlockDurationMinutes}
        attentionRating={timer.attentionRating}
        setAttentionRating={timer.setAttentionRating}
        stabilityRating={timer.stabilityRating}
        setStabilityRating={timer.setStabilityRating}
        localSessionNotes={timer.localSessionNotes}
        setLocalSessionNotes={timer.setLocalSessionNotes}
        onSubmitReflection={timer.submitReflection}
      />

      <HotkeyModal isOpen={isHotkeyHudOpen} onClose={() => setIsHotkeyHudOpen(false)} />

      {activeToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3),_inset_0_1px_1px_rgba(255,255,255,0.08)] rounded-full px-4 py-1.5 text-[11px] font-mono tracking-wider text-white animate-slide-down"
        >
          <kbd className="bg-white/10 text-white border border-white/15 rounded px-1.5 py-0.5 text-[9px] font-sans">{activeToast.key}</kbd>
          <span>{activeToast.message}</span>
        </div>
      )}

      <QuickNotesDrawer
        isOpen={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
        categories={categories.categories}
        addCategory={categories.addCategory}
        deleteCategory={categories.deleteCategory}
        notes={quickNotes.notes}
        addNote={quickNotes.addNote}
        updateNote={quickNotes.updateNote}
        deleteNote={quickNotes.deleteNote}
      />

      {!isZenMode && (
        <MobileTabBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isTimerActive={timer.isTimerActive}
          timerMode={timer.timerMode}
          enforceLockout={settings.enforce_lockout}
        />
      )}
    </div>
  )
}
