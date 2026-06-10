import { memo, useEffect, useState } from 'react'
import { AlertCircle, Brain } from 'lucide-react'
import type { ActiveTab } from '../types/app'
import { Sidebar } from './Sidebar'
import { AppContentHeader } from './AppContentHeader'
import { QuotaRecoveryBanner } from './QuotaRecoveryBanner'
import { ZenOverlayContainer } from './ZenOverlayContainer'
import { ReflectionModalContainer } from './ReflectionModalContainer'
import { HotkeyModal } from './HotkeyModal'
import { QuickNotesDrawer } from './QuickNotesDrawer'
import { MobileTabBar } from './MobileTabBar'
import { FocusTab } from './tabs/FocusTab'
import { AnalyticsTab } from './tabs/AnalyticsTab'
import { JournalTab } from './tabs/JournalTab'
import { CardsTab } from './tabs/CardsTab'
import { SettingsTab } from './tabs/SettingsTab'
import { db } from '../db/db'
import { useStudyData, useStudyUI } from '../context/useStudyApp'
import { useStudyTimerContext } from '../context/studyTimerContext'
import { useConfirm } from '../context/useConfirm'
import { E2eCrashProbe } from './E2eCrashProbe'
import { OnboardingModal } from './OnboardingModal'
import { countDueFlashcards } from './flashcard/flashcardDue'
import { getEffectiveDailyGoal, getTodayCategoryStudyMinutes } from '../lib/studyDashboard'
import { InstallPromptBanner } from './InstallPromptBanner'
import { usePwaInstall } from '../hooks/usePwaInstall'

export const AppShell = memo(function AppShell() {
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
    todayLog,
    flashcards,
    recentHistory,
  } = useStudyData()

  const cardsDueCount = countDueFlashcards(flashcards.flashcards)
  const pwaInstall = usePwaInstall()

  const { timerControls, backup } = useStudyTimerContext()

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
    quotaExceeded,
    dismissQuotaRecovery,
    isNotesOpen,
    setIsNotesOpen,
    scheduleDelete,
  } = useStudyUI()

  const activeTimerCategory = timerControls.timerCategoryId !== undefined
    ? categories.categories.find(c => c.id === timerControls.timerCategoryId)
    : undefined
  const headerStudyMinutes = activeTimerCategory?.id !== undefined
    ? getTodayCategoryStudyMinutes(recentHistory.history, activeTimerCategory.id)
    : todayLog.studyMinutes
  const headerGoalMinutes = getEffectiveDailyGoal(activeTimerCategory, settings.dailyGoalMinutes)

  const handleDeleteNote = async (id: number) => {
    const note = quickNotes.notes.find(n => n.id === id)
    if (!note) {
      void quickNotes.deleteNote(id)
      return
    }
    scheduleDelete('Note', () => quickNotes.deleteNote(id), async () => { await db.quick_notes.put(note) })
  }

  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem('sanctuary_onboarding_completed'),
  )
  const [onboardingForced, setOnboardingForced] = useState(false)
  const showOnboarding = (isDataReady && !onboardingDismissed) || onboardingForced

  const handleCloseOnboarding = () => {
    localStorage.setItem('sanctuary_onboarding_completed', 'true')
    setOnboardingDismissed(true)
    setOnboardingForced(false)
  }

  const openOnboarding = () => setOnboardingForced(true)

  const { requestConfirm } = useConfirm()

  const handleSetActiveTab = async (tab: ActiveTab) => {
    const locked =
      settings.enforce_lockout &&
      timerControls.isTimerActive &&
      timerControls.timerMode === 'study' &&
      tab !== 'focus'
    if (locked) {
      const ok = await requestConfirm({
        title: 'Focus Lockout Active',
        message: 'Your lockout setting is active to prevent distractions. Pause your study timer to navigate to other tabs.',
        confirmLabel: 'Pause & Navigate',
        danger: true,
      })
      if (ok) {
        timerControls.setIsTimerActive(false)
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
        <div className="dynamic-card flex flex-col items-center gap-5 px-8 py-7 shadow-2xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-tr from-accent-blue to-accent-purple shadow-md shadow-accent-blue/10">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <p className="text-sm text-white/60 font-semibold tracking-wide">Loading Study Dashboard</p>
            <p className="text-caption text-white/35">Preparing your local sanctuary...</p>
          </div>
        </div>
      </div>
    )
  }

  const isLight = activeThemeVars.isLight ?? false

  const inlineStyles = {
    '--color-surface': activeThemeVars.surface,
    '--color-surface-card': activeThemeVars.surfaceCard,
    '--color-text-primary': activeThemeVars.textPrimary ?? '#ffffff',
    '--color-text-secondary': activeThemeVars.textSecondary ?? 'rgba(255, 255, 255, 0.65)',
    '--color-text-muted': activeThemeVars.textMuted ?? 'rgba(255, 255, 255, 0.55)',
    '--color-on-accent': activeThemeVars.onAccent ?? '#080b11',
    '--color-accent-blue': activeThemeVars.accentBlue,
    '--color-accent-purple': activeThemeVars.accentPurple,
    '--color-accent-green': activeThemeVars.accentGreen,
    '--color-accent-amber': activeThemeVars.accentAmber,
    '--surface-card-rgb': activeThemeVars.surfaceCardRgb,
    '--surface-overlay': `rgba(${activeThemeVars.surfaceCardRgb}, 0.95)`,
    '--card-opacity': settings.cardOpacity,
    '--backdrop-blur': `${settings.backdropBlur}px`,
    '--backdrop-saturate': `${settings.backdropSaturate}%`,
    '--color-border-card': isLight
      ? `rgba(0, 0, 0, ${settings.cardBorderOpacity})`
      : `rgba(255, 255, 255, ${settings.cardBorderOpacity})`,
    background: activeThemeVars.pageGradient,
  } as React.CSSProperties

  return (
    <div
      data-theme-mode={isLight ? 'light' : 'dark'}
      data-density={settings.uiDensity}
      className="min-h-screen bg-transparent font-sans text-text-primary antialiased relative flex flex-col md:flex-row overflow-hidden pb-24 md:pb-0"
      style={inlineStyles}
    >
      <E2eCrashProbe />
      <Sidebar
        isZenMode={isZenMode}
        currentStreak={currentStreak}
        level={xpData.level}
        xpProgressPercent={xpData.xpProgressPercent}
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        setIsHotkeyHudOpen={setIsHotkeyHudOpen}
        isTimerActive={timerControls.isTimerActive}
        timerMode={timerControls.timerMode}
        enforceLockout={settings.enforce_lockout}
        cardsDueCount={cardsDueCount}
        onToggleNotes={() => setIsNotesOpen(!isNotesOpen)}
        onShowOnboarding={openOnboarding}
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
        {!isZenMode && pwaInstall.showBanner && (
          <InstallPromptBanner onInstall={() => void pwaInstall.install()} onDismiss={pwaInstall.dismiss} />
        )}
        {!isZenMode && quotaExceeded && (
          <QuotaRecoveryBanner
            onExport={() => void backup.exportStudyBackup()}
            onOpenRecovery={() => handleSetActiveTab('settings')}
            onDismiss={dismissQuotaRecovery}
          />
        )}
        {!isZenMode && (
          <AppContentHeader
            activeTab={activeTab}
            currentStreak={currentStreak}
            isTimerActive={timerControls.isTimerActive}
            timerMode={timerControls.timerMode}
            todayStudyMinutes={headerStudyMinutes}
            dailyGoalMinutes={headerGoalMinutes}
            focusCategoryName={activeTimerCategory?.name}
            onOpenNotes={() => setIsNotesOpen(true)}
          />
        )}

        <div className={`app-content-main flex-1 p-4 md:p-6 lg:p-8 flex flex-col transition-all duration-700 ${isZenMode ? 'opacity-0 scale-95 pointer-events-none' : ''}`}>
          {!isZenMode && (
            <div key={activeTab} className="app-tab-panel flex-1 flex flex-col min-h-0" data-active-tab={activeTab}>
              {activeTab === 'focus' && <FocusTab />}
              {activeTab === 'analytics' && <AnalyticsTab />}
              {activeTab === 'journal' && <JournalTab />}
              {activeTab === 'cards' && <CardsTab />}
              {activeTab === 'settings' && <SettingsTab onShowOnboarding={openOnboarding} />}
            </div>
          )}
        </div>
      </main>

      <ZenOverlayContainer
        isZenMode={isZenMode}
        canvasRef={canvasRef}
        sessionTasks={tasks.tasks}
        activeTaskId={activeTaskId}
        enforceLockout={settings.enforce_lockout}
        setIsZenMode={setIsZenMode}
        pageGradient={activeThemeVars.pageGradient}
      />

      <ReflectionModalContainer studyBlockDurationMinutes={settings.studyBlockDurationMinutes} />

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
          {activeToast.action && (
            <button
              type="button"
              onClick={activeToast.action.onClick}
              className="ml-1 rounded-full bg-white/15 px-2.5 py-0.5 text-label font-bold text-white hover:bg-white/25 ios-active-scale"
            >
              {activeToast.action.label}
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
        deleteNote={handleDeleteNote}
        noteTagColors={settings.noteTagColors}
      />

      {!isZenMode && (
        <MobileTabBar
          activeTab={activeTab}
          setActiveTab={handleSetActiveTab}
          isTimerActive={timerControls.isTimerActive}
          timerMode={timerControls.timerMode}
          enforceLockout={settings.enforce_lockout}
          cardsDueCount={cardsDueCount}
        />
      )}
    </div>
  )
})
