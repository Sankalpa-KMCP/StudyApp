import { ControlDeck } from '../ControlDeck'
import { useStudySettings, useStudyUI } from '../../context/useStudyApp'

export function SettingsTab() {
  const { settings, backup, confirmImport, handleFileDrop, categories } = useStudySettings()
  const { isDragging, setIsDragging } = useStudyUI()

  return (
    <ControlDeck
      updateSetting={settings.updateSetting}
      theme={settings.theme}
      cardOpacity={settings.cardOpacity}
      backdropBlur={settings.backdropBlur}
      initialEasinessFactor={settings.initialEasinessFactor}
      dailyGoalMinutes={settings.dailyGoalMinutes}
      studyBlockDurationMinutes={settings.studyBlockDurationMinutes}
      shortBreakDurationMinutes={settings.shortBreakDurationMinutes}
      longBreakDurationMinutes={settings.longBreakDurationMinutes}
      targetSessionsPerCycle={settings.targetSessionsPerCycle}
      soundEnabled={settings.soundEnabled}
      tactileEnabled={settings.tactile_feedback}
      developerFont={settings.developer_font}
      enforceLockout={settings.enforce_lockout}
      autoArchiveAncientTasks={settings.autoArchiveAncientTasks}
      exportStudyBackup={backup.exportStudyBackup}
      exportStudyLogsCSV={backup.exportStudyLogsCSV}
      exportTaskCompletionLogsCSV={backup.exportTaskCompletionLogsCSV}
      importStudyBackup={confirmImport}
      resetData={backup.resetData}
      resetDataSelective={backup.resetDataSelective}
      categories={categories.categories}
      addCategory={categories.addCategory}
      deleteCategory={categories.deleteCategory}
      isDragging={isDragging}
      setIsDragging={setIsDragging}
      handleFileDrop={handleFileDrop}
      fileInputRef={backup.fileInputRef}
    />
  )
}
