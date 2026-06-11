import { memo, useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { AppContentHeader } from './AppContentHeader'
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
import { E2eCrashProbe } from './E2eCrashProbe'
import { OnboardingModal } from './OnboardingModal'
import { countDueFlashcards } from './flashcard/flashcardDue'
import { getEffectiveDailyGoal, getTodayCategoryStudyMinutes } from '../lib/studyDashboard'
import { usePwaInstall } from '../hooks/usePwaInstall'
import { useFocusLockoutNavigation } from '../hooks/useFocusLockoutNavigation'
import { buildThemeInlineStyles } from '../lib/applyThemeVars'
import { AppShellLoadingScreen } from './app-shell/AppShellLoadingScreen'
import { AppShellStatusBanners } from './app-shell/AppShellStatusBanners'
import { AppToastOverlay } from './app-shell/AppToastOverlay'

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

  const handleSetActiveTab = useFocusLockoutNavigation({
    enforceLockout: settings.enforce_lockout,
    timer: timerControls,
    setActiveTab,
  })

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

  if (!isDataReady) {
    return <AppShellLoadingScreen pageGradient={activeThemeVars.pageGradient} />
  }

  const isLight = activeThemeVars.isLight ?? false
  const inlineStyles = buildThemeInlineStyles(activeThemeVars, {
    cardOpacity: settings.cardOpacity,
    backdropBlur: settings.backdropBlur,
    backdropSaturate: settings.backdropSaturate,
    cardBorderOpacity: settings.cardBorderOpacity,
  })

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
        <AppShellStatusBanners
          isOffline={isOffline}
          isZenMode={isZenMode}
          showPwaBanner={pwaInstall.showBanner}
          quotaExceeded={quotaExceeded}
          onPwaInstall={() => void pwaInstall.install()}
          onPwaDismiss={pwaInstall.dismiss}
          onExportBackup={() => void backup.exportStudyBackup()}
          onOpenRecovery={() => void handleSetActiveTab('settings')}
          onDismissQuota={dismissQuotaRecovery}
        />
        {!isZenMode && (
          <AppContentHeader
            activeTab={activeTab}
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
      <AppToastOverlay toast={activeToast} />

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
