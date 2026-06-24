import { memo } from 'react'
import { Sidebar } from '../Sidebar'
import { AppContentHeader } from '../AppContentHeader'
import { MobileTabBar } from '../MobileTabBar'
import { FocusTab } from '../tabs/FocusTab'
import { AnalyticsTab } from '../tabs/AnalyticsTab'
import { JournalTab } from '../tabs/JournalTab'
import { SettingsTab } from '../tabs/SettingsTab'
import { ErrorBoundary } from '../ErrorBoundary'
import { useStudyData, useStudyUI } from '../../context/useStudyApp'
import { useStudyTimerContext } from '../../context/studyTimerContext'
import { getEffectiveDailyGoal, getTodayCategoryStudyMinutes } from '../../lib/study/studyDashboard'
import { useReviewDueCount } from '../../hooks/useReviewDueCount'
import { AppShellBanners, type AppShellBannersProps } from './AppShellBanners'

interface AppShellLayoutProps {
  onShowOnboarding: () => void
  banners: AppShellBannersProps
}

export const AppShellLayout = memo(function AppShellLayout({
  onShowOnboarding,
  banners,
}: AppShellLayoutProps) {
  const {
    tasks,
    settings,
    categories,
    currentStreak,
    xpData,
    todayLog,
    recentHistory,
  } = useStudyData()

  const {
    activeTab,
    setActiveTab,
    isZenMode,
    isNotesOpen,
    setIsHotkeyHudOpen,
    setIsNotesOpen,
    setIsCommandPaletteOpen,
  } = useStudyUI()

  const { timerControls } = useStudyTimerContext()
  const reviewDueCount = useReviewDueCount(tasks.tasks)

  const activeTimerCategory = timerControls.timerCategoryId !== undefined
    ? categories.categories.find(c => c.id === timerControls.timerCategoryId)
    : undefined
  const headerStudyMinutes = activeTimerCategory?.id !== undefined
    ? getTodayCategoryStudyMinutes(recentHistory.history, activeTimerCategory.id)
    : todayLog.studyMinutes
  const headerGoalMinutes = getEffectiveDailyGoal(activeTimerCategory, settings.dailyGoalMinutes)

  return (
    <>
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
        reviewDueCount={reviewDueCount}
        onToggleNotes={() => setIsNotesOpen(!isNotesOpen)}
        onShowOnboarding={onShowOnboarding}
      />

      <main className="flex-1 flex flex-col min-w-0 z-10">
        <AppShellBanners {...banners} />
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
            onShowOnboarding={onShowOnboarding}
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
                  <SettingsTab onShowOnboarding={onShowOnboarding} />
                </ErrorBoundary>
              )}
            </div>
          )}
        </div>
      </main>

      {!isZenMode && (
        <MobileTabBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isTimerActive={timerControls.isTimerActive}
          timerMode={timerControls.timerMode}
          enforceLockout={settings.enforce_lockout}
          reviewDueCount={reviewDueCount}
        />
      )}
    </>
  )
})
