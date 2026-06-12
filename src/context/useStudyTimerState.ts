import { useCallback, useState } from 'react'
import { useConfirm } from './useConfirm'
import { useSessionBackup } from '../hooks/useSessionBackup'
import { useAmbientSynth } from '../hooks/useAmbientSynth'
import { useAmbientSound } from '../hooks/useAmbientSound'
import { useTimerEngine } from '../hooks/useTimerEngine'
import { useTaskActions } from '../hooks/useTaskActions'
import { useStudyDataContext } from './studyDataContext'
import type { TaskItem } from '../db/types'
import type { useAppToast } from '../hooks/useAppToast'

type PushToast = ReturnType<typeof useAppToast>['pushToast']

export function useStudyTimerState(pushToast: PushToast) {
  const { requestConfirm } = useConfirm()
  const {
    isDataReady,
    tasks,
    history,
    settings,
    todayLog,
    categories,
  } = useStudyDataContext()

  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [taskCycleCount, setTaskCycleCount] = useState(1)

  const backup = useSessionBackup(pushToast)
  const { playChime, ensureAudio } = useAmbientSynth({
    soundEnabled: settings.soundEnabled,
    tactileEnabled: settings.tactile_feedback,
  })

  const engine = useTimerEngine({
    isDataReady,
    studyBlockDurationMinutes: settings.studyBlockDurationMinutes,
    shortBreakDurationMinutes: settings.shortBreakDurationMinutes,
    longBreakDurationMinutes: settings.longBreakDurationMinutes,
    targetSessionsPerCycle: settings.targetSessionsPerCycle,
    initialEasinessFactor: settings.initialEasinessFactor,
    schedulingAlgorithm: settings.schedulingAlgorithm,
    sessionTasks: tasks.tasks,
    categories: categories.categories,
    incrementStudy: todayLog.incrementStudy,
    incrementBreak: todayLog.incrementBreak,
    addHistoryEntry: history.addEntry,
    playChime,
    createDatabaseSnapshot: backup.createDatabaseSnapshot,
    pushToast,
    activeTaskId,
    setActiveTaskId,
    focusNotificationsEnabled: settings.focusNotificationsEnabled,
    desktopNativeNotificationsEnabled: settings.desktopNativeNotificationsEnabled,
  })

  const { controls: timerControls, display: timerDisplay } = engine

  useAmbientSound({
    enabled: settings.ambientSoundEnabled,
    preset: settings.ambientSoundPreset,
    volumePercent: settings.ambientVolume,
    isTimerActive: timerControls.isTimerActive,
    timerMode: timerControls.timerMode,
  })

  const activateTask = useCallback((task: TaskItem) => {
    if (task.id === undefined) return
    setActiveTaskId(task.id)
    if (task.categoryId !== undefined) {
      timerControls.setTimerCategoryId(task.categoryId)
    }
    if (timerControls.timerMode === 'study' && !timerControls.isTimerActive) {
      ensureAudio()
      timerControls.setIsTimerActive(true)
    }
  }, [ensureAudio, timerControls])

  const { handleAddTask, handleToggleTask } = useTaskActions({
    sessionTasks: tasks.tasks,
    addTask: tasks.addTask,
    toggleTask: tasks.toggleTask,
    playChime,
    activeTaskId,
    setActiveTaskId,
    activateTask,
    sessionCategoryId: timerControls.timerCategoryId,
    taskCycleCount,
    autoArchiveAncientTasks: settings.autoArchiveAncientTasks,
    autoArchiveAfterDays: settings.autoArchiveAfterDays,
    isDataReady,
    pushToast,
  })

  const confirmImport = useCallback(async (fileString: string, options?: { mode?: 'replace' | 'merge'; passphrase?: string }) => {
    const warn = timerControls.isTimerActive || timerControls.showReflectionModal
    const storedMode = sessionStorage.getItem('backup_import_mode')
    const storedPassphrase = sessionStorage.getItem('backup_import_passphrase')
    const mode = options?.mode ?? (storedMode === 'merge' ? 'merge' : 'replace')
    const passphrase = options?.passphrase ?? (storedPassphrase || undefined)
    sessionStorage.removeItem('backup_import_mode')
    sessionStorage.removeItem('backup_import_passphrase')
    const ok = await requestConfirm({
      title: warn ? 'Import during active session?' : mode === 'merge' ? 'Merge backup?' : 'Import backup?',
      message: warn
        ? 'Importing will affect workspace data. An active timer or reflection is in progress.'
        : mode === 'merge'
        ? 'Merge adds new records and combines daily logs. Local settings are kept.'
        : 'Importing will replace all workspace data. Continue?',
      confirmLabel: mode === 'merge' ? 'Merge' : 'Import',
      danger: mode !== 'merge',
    })
    if (!ok) return
    void backup.importStudyBackup(fileString, { mode, passphrase })
  }, [backup, requestConfirm, timerControls.isTimerActive, timerControls.showReflectionModal])

  return {
    backup,
    timerControls,
    timerDisplay,
    ensureAudio,
    handleAddTask,
    handleToggleTask,
    activateTask,
    activeTaskId,
    setActiveTaskId,
    taskCycleCount,
    setTaskCycleCount,
    confirmImport,
  }
}
