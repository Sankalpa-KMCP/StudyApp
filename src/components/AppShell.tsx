import { lazy, memo, Suspense, useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { AppContentHeader } from './AppContentHeader'
import { ZenOverlayContainer } from './ZenOverlayContainer'
import { ReflectionModalContainer } from './ReflectionModalContainer'
import { HotkeyModal } from './HotkeyModal'
import { MobileTabBar } from './MobileTabBar'
import { FocusTab } from './tabs/FocusTab'
import { AnalyticsTab } from './tabs/AnalyticsTab'
import { JournalTab } from './tabs/JournalTab'
import { SettingsTab } from './tabs/SettingsTab'
import { useStudyData, useStudyUI } from '../context/useStudyApp'
import { useStudyTimerContext } from '../context/studyTimerContext'
import { E2eCrashProbe } from './E2eCrashProbe'
import { OnboardingModal } from './OnboardingModal'
import { getEffectiveDailyGoal, getTodayCategoryStudyMinutes } from '../lib/study/studyDashboard'
import { usePwaInstall } from '../hooks/usePwaInstall'
import { useBackupReminder } from '../hooks/useBackupReminder'
import { buildThemeInlineStyles } from '../lib/theme/applyThemeVars'
import { AppShellLoadingScreen } from './app-shell/AppShellLoadingScreen'
import { AppShellStatusBanners } from './app-shell/AppShellStatusBanners'
import { AppToastOverlay } from './app-shell/AppToastOverlay'
import { LevelUpModal } from './LevelUpModal'
import { ErrorBoundary } from './ErrorBoundary'
import { CelebrationConfettiHost } from './shared/CelebrationConfettiHost'
import { useAppShellEffects } from '../hooks/app-shell/useAppShellEffects'
import { useCommandPaletteActions } from '../hooks/app-shell/useCommandPaletteActions'
import { useAppShellOnboarding } from '../hooks/app-shell/useAppShellOnboarding'
import { useNoteDeleteUndo } from '../hooks/app-shell/useNoteDeleteUndo'
import { DesktopTrayTimerBridge } from './app-shell/DesktopTrayTimerBridge'

const CommandPalette = lazy(() =>
  import('./CommandPalette').then(m => ({ default: m.CommandPalette })),
)
const QuickNotesDrawer = lazy(() =>
  import('./QuickNotesDrawer').then(m => ({ default: m.QuickNotesDrawer })),
)

export const AppShell = memo(function AppShell() {
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
    recentHistory,
    allLogs,
  } = useStudyData()

  const pwaInstall = usePwaInstall()
  const backupReminder = useBackupReminder()
  const { timerControls, backup, activateTask } = useStudyTimerContext()

  const { isOffline } = useAppShellEffects({
    isDataReady,
    studyReminderEnabled: settings.studyReminderEnabled,
    studyReminderTime: settings.studyReminderTime,
    studyReminderOnlyBelowGoal: settings.studyReminderOnlyBelowGoal,
    dailyGoalMinutes: settings.dailyGoalMinutes,
    todayStudyMinutes: todayLog.studyMinutes,
    autoExportEnabled: settings.autoExportEnabled,
    autoExportIntervalDays: settings.autoExportIntervalDays,
    syncEnabled: settings.syncEnabled,
    syncFolderPath: settings.syncFolderPath,
    desktopAutostartEnabled: settings.desktopAutostartEnabled,
    desktopGlobalShortcutsEnabled: settings.desktopGlobalShortcutsEnabled,
    exportBackup: () => {
      void backup.exportStudyBackup({ destination: 'auto' }).then(() => backupReminder.refresh())
    },
    timerControls,
  })

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

  const handleCommandPaletteSelect = useCommandPaletteActions({
    tasks: tasks.tasks,
    timerControls,
    backup,
    backupReminder,
    activateTask,
    setActiveTab,
    setIsZenMode,
    setIsHotkeyHudOpen,
    setFocusNoteId,
    setIsNotesOpen,
  })

  const { handleDeleteNote } = useNoteDeleteUndo({
    notes: quickNotes.notes,
    deleteNote: quickNotes.deleteNote,
    scheduleDelete,
  })

  const { showOnboarding, handleCloseOnboarding, openOnboarding } = useAppShellOnboarding(isDataReady)
  const [commandPaletteMounted, setCommandPaletteMounted] = useState(false)
  const [notesDrawerMounted, setNotesDrawerMounted] = useState(false)

  useEffect(() => {
    if (isCommandPaletteOpen) setCommandPaletteMounted(true)
  }, [isCommandPaletteOpen])

  useEffect(() => {
    if (isNotesOpen) setNotesDrawerMounted(true)
  }, [isNotesOpen])

  const handleOnboardingClose = () => {
    handleCloseOnboarding()
    void setActiveTab('focus')
  }

  const activeTimerCategory = timerControls.timerCategoryId !== undefined
    ? categories.categories.find(c => c.id === timerControls.timerCategoryId)
    : undefined
  const headerStudyMinutes = activeTimerCategory?.id !== undefined
    ? getTodayCategoryStudyMinutes(recentHistory.history, activeTimerCategory.id)
    : todayLog.studyMinutes
  const headerGoalMinutes = getEffectiveDailyGoal(activeTimerCategory, settings.dailyGoalMinutes)

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
      data-reduce-effects={settings.reduceVisualEffects ? 'true' : 'false'}
      className="app-grain min-h-screen bg-transparent font-sans text-text-primary antialiased relative flex flex-col md:flex-row overflow-hidden pb-24 md:pb-0"
      style={inlineStyles}
    >
      <E2eCrashProbe />
      <DesktopTrayTimerBridge />
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
      <HotkeyModal isOpen={isHotkeyHudOpen} onClose={() => setIsHotkeyHudOpen(false)} />
      {commandPaletteMounted && (
        <Suspense fallback={null}>
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            onSelect={handleCommandPaletteSelect}
            tasks={tasks.tasks}
            notes={quickNotes.notes}
            categories={categories.categories}
            dailyLogs={allLogs.allLogs}
          />
        </Suspense>
      )}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={handleOnboardingClose}
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

      {notesDrawerMounted && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {!isZenMode && (
        <MobileTabBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isTimerActive={timerControls.isTimerActive}
          timerMode={timerControls.timerMode}
          enforceLockout={settings.enforce_lockout}
        />
      )}
      <CelebrationConfettiHost />
    </div>
  )
})
