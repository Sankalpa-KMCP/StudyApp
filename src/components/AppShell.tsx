import { memo, useEffect, useRef, useState } from 'react'
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
import { useStudyTimerContext, useStudyTimerDisplay } from '../context/studyTimerContext'
import { E2eCrashProbe } from './E2eCrashProbe'
import { OnboardingModal } from './OnboardingModal'
import { countDueFlashcards } from './flashcard/flashcardDue'
import { getEffectiveDailyGoal, getTodayCategoryStudyMinutes } from '../lib/studyDashboard'
import { usePwaInstall } from '../hooks/usePwaInstall'
import { useBackupReminder } from '../hooks/useBackupReminder'
import { useAutoExport } from '../hooks/useAutoExport'
import { applySavedDesktopSettings, initDesktopTrayBridge, isTauri, setDesktopTrayTooltip } from '../lib/tauri'
import { buildThemeInlineStyles } from '../lib/applyThemeVars'
import { AppShellLoadingScreen } from './app-shell/AppShellLoadingScreen'
import { AppShellStatusBanners } from './app-shell/AppShellStatusBanners'
import { AppToastOverlay } from './app-shell/AppToastOverlay'
import { LevelUpModal } from './LevelUpModal'
import { prefetchIdleTabChunks } from '../lib/prefetchTabChunks'
import { scrollToSettingsSectionWhenReady } from '../lib/settingsSections'
import { setFlashcardReviewPending } from '../lib/flashcardReviewPending'
import { ErrorBoundary } from './ErrorBoundary'
import { CelebrationConfettiHost } from './shared/CelebrationConfettiHost'
import { CommandPalette } from './CommandPalette'
import type { CommandPaletteSelection } from './CommandPalette'

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
    pendingLevelUp,
    dismissLevelUp,
    todayLog,
    flashcards,
    recentHistory,
  } = useStudyData()

  const cardsDueCount = settings.flashcardsEnabled ? countDueFlashcards(flashcards.flashcards) : 0
  const pwaInstall = usePwaInstall()
  const backupReminder = useBackupReminder()
  const { timerControls, backup, activateTask } = useStudyTimerContext()
  const timerDisplay = useStudyTimerDisplay()

  useAutoExport({
    enabled: settings.autoExportEnabled,
    intervalDays: settings.autoExportIntervalDays,
    isDataReady,
    exportBackup: () => {
      void backup.exportStudyBackup({ destination: 'auto' }).then(() => backupReminder.refresh())
    },
  })

  const desktopSettingsAppliedRef = useRef(false)
  useEffect(() => {
    if (!isDataReady || !isTauri() || desktopSettingsAppliedRef.current) return
    desktopSettingsAppliedRef.current = true
    void applySavedDesktopSettings({
      desktopAutostartEnabled: settings.desktopAutostartEnabled,
      desktopGlobalShortcutsEnabled: settings.desktopGlobalShortcutsEnabled,
    })
  }, [
    isDataReady,
    settings.desktopAutostartEnabled,
    settings.desktopGlobalShortcutsEnabled,
  ])

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
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    focusNoteId,
    setFocusNoteId,
    scheduleDelete,
  } = useStudyUI()

  const handleCommandPaletteSelect = (selection: CommandPaletteSelection) => {
    if (selection.tab) void setActiveTab(selection.tab)
    if (selection.settingsSection) {
      void setActiveTab('settings')
      scrollToSettingsSectionWhenReady(selection.settingsSection!)
    }
    if (selection.taskId != null) {
      const task = tasks.tasks.find(t => t.id === selection.taskId)
      if (task) {
        void setActiveTab('focus')
        activateTask(task)
      }
    }
    if (selection.noteId != null) {
      setFocusNoteId(selection.noteId)
      setIsNotesOpen(true)
    }
    if (selection.flashcardId != null) {
      setFlashcardReviewPending()
      void setActiveTab('cards')
    }
  }

  useEffect(() => {
    void initDesktopTrayBridge()
    const onDesktopTimerToggle = () => {
      timerControls.setIsTimerActive(active => !active)
    }
    window.addEventListener('desktop-timer-toggle', onDesktopTimerToggle)
    return () => window.removeEventListener('desktop-timer-toggle', onDesktopTimerToggle)
  }, [timerControls])

  useEffect(() => {
    if (!isTauri()) return
    const mins = Math.floor(timerDisplay.remainingSeconds / 60)
    const secs = timerDisplay.remainingSeconds % 60
    const time = `${mins}:${secs.toString().padStart(2, '0')}`
    const mode = timerControls.timerMode === 'study' ? 'Focus' : 'Break'
    const state = timerControls.isTimerActive ? 'Running' : 'Paused'
    void setDesktopTrayTooltip(`Study Dashboard — ${mode} ${time} (${state})`)
  }, [
    timerDisplay.remainingSeconds,
    timerControls.isTimerActive,
    timerControls.timerMode,
  ])

  useEffect(() => {
    if (!isDataReady) return
    const id = window.requestIdleCallback
      ? window.requestIdleCallback(() => prefetchIdleTabChunks(settings.flashcardsEnabled))
      : window.setTimeout(() => prefetchIdleTabChunks(settings.flashcardsEnabled), 2000)
    return () => {
      if (typeof id === 'number') window.clearTimeout(id)
      else window.cancelIdleCallback?.(id)
    }
  }, [isDataReady, settings.flashcardsEnabled])

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
      data-ui-font={settings.ui_font}
      className="app-grain min-h-screen bg-transparent font-sans text-text-primary antialiased relative flex flex-col md:flex-row overflow-hidden pb-24 md:pb-0"
      style={inlineStyles}
    >
      <E2eCrashProbe />
      <Sidebar
        isZenMode={isZenMode}
        currentStreak={currentStreak}
        level={xpData.level}
        xpProgressPercent={xpData.xpProgressPercent}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setIsHotkeyHudOpen={setIsHotkeyHudOpen}
        isTimerActive={timerControls.isTimerActive}
        timerMode={timerControls.timerMode}
        enforceLockout={settings.enforce_lockout}
        cardsDueCount={cardsDueCount}
        flashcardsEnabled={settings.flashcardsEnabled}
        onToggleNotes={() => setIsNotesOpen(!isNotesOpen)}
        onShowOnboarding={openOnboarding}
      />

      <main className="flex-1 flex flex-col min-w-0 z-10">
        <AppShellStatusBanners
          isOffline={isOffline}
          isZenMode={isZenMode}
          showPwaBanner={pwaInstall.showBanner}
          quotaExceeded={quotaExceeded}
          showBackupReminder={backupReminder.shouldRemind}
          backupDaysSinceExport={backupReminder.daysSinceExport}
          onPwaInstall={() => void pwaInstall.install()}
          onPwaDismiss={pwaInstall.dismiss}
          onExportBackup={() => {
            void backup.exportStudyBackup({ destination: 'download' }).then(() => backupReminder.refresh())
          }}
          onOpenRecovery={() => void setActiveTab('settings')}
          onDismissQuota={dismissQuotaRecovery}
          onDismissBackupReminder={backupReminder.dismissReminder}
        />
        {!isZenMode && (
          <AppContentHeader
            activeTab={activeTab}
            isTimerActive={timerControls.isTimerActive}
            timerMode={timerControls.timerMode}
            todayStudyMinutes={headerStudyMinutes}
            dailyGoalMinutes={headerGoalMinutes}
            focusCategoryName={activeTimerCategory?.name}
            currentStreak={currentStreak}
            level={xpData.level}
            xpProgressPercent={xpData.xpProgressPercent}
            enforceLockout={settings.enforce_lockout}
            onOpenNotes={() => setIsNotesOpen(true)}
            onNavigateToAnalytics={() => void setActiveTab('analytics')}
            onShowOnboarding={openOnboarding}
            onOpenHotkeys={() => setIsHotkeyHudOpen(true)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          />
        )}

        <div className={`app-content-main flex-1 p-4 md:p-6 lg:p-8 flex flex-col transition-all duration-700 ${isZenMode ? 'opacity-0 scale-95 pointer-events-none' : ''}`}>
          {!isZenMode && (
            <div key={activeTab} className="app-tab-panel flex-1 flex flex-col min-h-0" data-active-tab={activeTab}>
              {activeTab === 'focus' && (
                <ErrorBoundary fallbackLabel="Focus">
                  <FocusTab />
                </ErrorBoundary>
              )}
              {activeTab === 'analytics' && (
                <ErrorBoundary fallbackLabel="Analytics">
                  <AnalyticsTab />
                </ErrorBoundary>
              )}
              {activeTab === 'journal' && (
                <ErrorBoundary fallbackLabel="Journal">
                  <JournalTab />
                </ErrorBoundary>
              )}
              {settings.flashcardsEnabled && activeTab === 'cards' && (
                <ErrorBoundary fallbackLabel="Cards">
                  <CardsTab />
                </ErrorBoundary>
              )}
              {activeTab === 'settings' && (
                <ErrorBoundary fallbackLabel="Settings">
                  <SettingsTab onShowOnboarding={openOnboarding} />
                </ErrorBoundary>
              )}
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
      <HotkeyModal isOpen={isHotkeyHudOpen} onClose={() => setIsHotkeyHudOpen(false)} flashcardsEnabled={settings.flashcardsEnabled} />
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelect={handleCommandPaletteSelect}
        tasks={tasks.tasks}
        notes={quickNotes.notes}
        flashcards={flashcards.flashcards}
        categories={categories.categories}
        flashcardsEnabled={settings.flashcardsEnabled}
      />
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={handleCloseOnboarding}
        updateSetting={settings.updateSetting}
        onOpenBackup={() => {
          void setActiveTab('settings')
          requestAnimationFrame(() => {
            document.getElementById('settings-backup-vault')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          })
        }}
        onReplayTour={openOnboarding}
      />
      <AppToastOverlay toast={activeToast} />
      {pendingLevelUp !== null && (
        <LevelUpModal
          level={pendingLevelUp}
          xpProgressPercent={xpData.xpProgressPercent}
          onDismiss={dismissLevelUp}
        />
      )}

      <QuickNotesDrawer
        isOpen={isNotesOpen}
        onClose={() => {
          setIsNotesOpen(false)
          setFocusNoteId(null)
        }}
        focusNoteId={focusNoteId}
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
          setActiveTab={setActiveTab}
          isTimerActive={timerControls.isTimerActive}
          timerMode={timerControls.timerMode}
          enforceLockout={settings.enforce_lockout}
          cardsDueCount={cardsDueCount}
          flashcardsEnabled={settings.flashcardsEnabled}
        />
      )}
      <CelebrationConfettiHost />
    </div>
  )
})
