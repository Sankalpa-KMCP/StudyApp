import { lazy, Suspense } from 'react'
import { TabLoadingFallback } from '../shared/TabLoadingFallback'
import { useStudySettings, useStudyUI } from '../../context/useStudyApp'

const ControlDeck = lazy(() =>
  import('../ControlDeck').then(m => ({ default: m.ControlDeck })),
)

interface SettingsTabProps {
  onShowOnboarding?: () => void
}

export function SettingsTab({ onShowOnboarding }: SettingsTabProps) {
  const { settings, backup, confirmImport, handleFileDrop, categories } = useStudySettings()
  const { isDragging, setIsDragging, quotaExceeded } = useStudyUI()

  return (
    <Suspense fallback={<TabLoadingFallback label="settings" />}>
      <ControlDeck
        updateSetting={settings.updateSetting}
        theme={settings.theme}
        themePreset={settings.themePreset}
        lightThemePreset={settings.lightThemePreset}
        uiFont={settings.ui_font}
        uiDensity={settings.uiDensity}
        cardOpacity={settings.cardOpacity}
        backdropBlur={settings.backdropBlur}
        backdropSaturate={settings.backdropSaturate}
        cardBorderOpacity={settings.cardBorderOpacity}
        accentBlueOverride={settings.accentBlueOverride}
        accentPurpleOverride={settings.accentPurpleOverride}
        accentGreenOverride={settings.accentGreenOverride}
        accentAmberOverride={settings.accentAmberOverride}
        noteTagColors={settings.noteTagColors}
        initialEasinessFactor={settings.initialEasinessFactor}
        dailyGoalMinutes={settings.dailyGoalMinutes}
        studyBlockDurationMinutes={settings.studyBlockDurationMinutes}
        shortBreakDurationMinutes={settings.shortBreakDurationMinutes}
        longBreakDurationMinutes={settings.longBreakDurationMinutes}
        targetSessionsPerCycle={settings.targetSessionsPerCycle}
        recentHistoryLimit={settings.recentHistoryLimit}
        focusNotificationsEnabled={settings.focusNotificationsEnabled}
        soundEnabled={settings.soundEnabled}
        tactileEnabled={settings.tactile_feedback}
        developerFont={settings.developer_font}
        enforceLockout={settings.enforce_lockout}
        autoArchiveAncientTasks={settings.autoArchiveAncientTasks}
        exportStudyBackup={backup.exportStudyBackup}
        isExporting={backup.isExporting}
        exportProgress={backup.exportProgress}
        exportStudyLogsCSV={backup.exportStudyLogsCSV}
        exportTaskCompletionLogsCSV={backup.exportTaskCompletionLogsCSV}
        importStudyBackup={confirmImport}
        resetData={backup.resetData}
        resetDataSelective={backup.resetDataSelective}
        clearSnapshots={backup.clearSnapshots}
        quotaExceeded={quotaExceeded}
        categories={categories.categories}
        updateCategory={categories.updateCategory}
        addCategory={categories.addCategory}
        deleteCategory={categories.deleteCategory}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        handleFileDrop={handleFileDrop}
        fileInputRef={backup.fileInputRef}
        onShowOnboarding={onShowOnboarding}
      />
    </Suspense>
  )
}
