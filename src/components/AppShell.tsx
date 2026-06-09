import { useEffect, useState } from 'react'
import { Brain, Flame, Keyboard, FileText, AlertCircle } from 'lucide-react'
import type { ActiveTab } from '../types/app'
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
import { useStudyData, useStudyUI } from '../context/useStudyApp'
import { useStudyTimerContext } from '../context/studyTimerContext'
import { useConfirm } from '../context/useConfirm'
import { E2eCrashProbe } from './E2eCrashProbe'
import { OnboardingModal } from './OnboardingModal'

export function AppShell() {
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)

  useEffect(() => {
    const onOnline = () => setIsOffline(false)
    const onOffline = () => setIsOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const {
    isDataReady,
    tasks,
    settings,
    quickNotes,
    categories,
    currentStreak,
    xpData,
  } = useStudyData()

  const { timer } = useStudyTimerContext()

  const {
    activeTab,
    setActiveTab,
    isZenMode,
    setIsZenMode,
    isHotkeyHudOpen,
    setIsHotkeyHudOpen,
    activeTaskId,
    activeThemeVars,
    canvasRef,
    activeToast,
    isNotesOpen,
    setIsNotesOpen,
  } = useStudyUI()

  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    const completed = localStorage.getItem('sanctuary_onboarding_completed')
    if (!completed && isDataReady) {
      setShowOnboarding(true)
    }
  }, [isDataReady])

  const handleCloseOnboarding = () => {
    localStorage.setItem('sanctuary_onboarding_completed', 'true')
    setShowOnboarding(false)
  }

  const { requestConfirm } = useConfirm()

  const handleSetActiveTab = async (tab: ActiveTab) => {
    const locked =
      settings.enforce_lockout &&
      timer.isTimerActive &&
      timer.timerMode === 'study' &&
      tab !== 'focus'
    if (locked) {
      const ok = await requestConfirm({
        title: 'Focus Lockout Active',
        message: 'Your lockout setting is active to prevent distractions. Pause your study timer to navigate to other tabs.',
        confirmLabel: 'Pause & Navigate',
        danger: true,
      })
      if (ok) {
        timer.setIsTimerActive(false)
        setActiveTab(tab)
      }
      return
    }
    setActiveTab(tab)
  }

  if (!isDataReady) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: activeThemeVars.pageGradient }}
      >
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
    background: activeThemeVars.pageGradient,
  } as React.CSSProperties

  return (
    <div className="min-h-screen bg-transparent font-sans text-text-primary antialiased relative flex flex-col md:flex-row overflow-hidden pb-16 md:pb-0" style={inlineStyles}>
      <E2eCrashProbe />
      <Sidebar
        isZenMode={isZenMode}
        currentStreak={currentStreak}
        level={xpData.level}
        xpProgressPercent={xpData.xpProgressPercent}
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        setIsHotkeyHudOpen={setIsHotkeyHudOpen}
        isTimerActive={timer.isTimerActive}
        timerMode={timer.timerMode}
        enforceLockout={settings.enforce_lockout}
        onToggleNotes={() => setIsNotesOpen(!isNotesOpen)}
      />

      <main className="flex-1 flex flex-col min-w-0 z-10">
        {isOffline && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-label font-semibold text-amber-200"
          >
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            You are offline — data stays on this device
          </div>
        )}
        {!isZenMode && (
          <header className="flex md:hidden items-center justify-between px-4 py-2.5 border-b border-white/5 bg-black/10 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-accent-blue" />
              <span className="font-bold text-sm text-white">Study Dashboard</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-1">
                <Flame className="h-3.5 w-3.5 text-accent-amber" />
                <span className="text-label font-mono font-bold text-accent-amber">{currentStreak}d</span>
              </div>
              <button
                onClick={() => setIsNotesOpen(!isNotesOpen)}
                aria-label="Quick notes"
                className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue"
              >
                <FileText className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsHotkeyHudOpen(true)}
                aria-label="Keyboard shortcuts"
                className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue"
              >
                <Keyboard className="h-4 w-4" />
              </button>
            </div>
          </header>
        )}

        <div className={`flex-1 p-4 md:p-6 lg:p-8 flex flex-col transition-all duration-700 ${isZenMode ? 'opacity-0 scale-95 pointer-events-none' : ''}`}>
          {!isZenMode && (
            <div key={activeTab} className="flex-1 flex flex-col min-h-0 animate-fade-in">
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
        pageGradient={activeThemeVars.pageGradient}
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

      <OnboardingModal isOpen={showOnboarding} onClose={handleCloseOnboarding} />

      {activeToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3),_inset_0_1px_1px_rgba(255,255,255,0.08)] rounded-full px-4 py-1.5 text-label font-mono tracking-wider text-white animate-slide-down"
        >
          <kbd className="bg-white/10 text-white border border-white/15 rounded px-1.5 py-0.5 text-label font-sans">{activeToast.key}</kbd>
          <span>{activeToast.message}</span>
          {activeToast.key === 'DATABASE' && activeToast.message.toLowerCase().includes('quota') && (
            <button
              type="button"
              onClick={() => handleSetActiveTab('settings')}
              className="rounded-full bg-white/15 px-2.5 py-0.5 text-label font-sans font-bold hover:bg-white/25"
            >
              Open backup
            </button>
          )}
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
          setActiveTab={handleSetActiveTab}
          isTimerActive={timer.isTimerActive}
          timerMode={timer.timerMode}
          enforceLockout={settings.enforce_lockout}
        />
      )}
    </div>
  )
}
