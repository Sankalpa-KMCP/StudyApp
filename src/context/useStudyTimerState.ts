import { useCallback, useState } from 'react'
import { useConfirm } from './useConfirm'
import { useSessionBackup } from '../hooks/useSessionBackup'
import { useAmbientSynth } from '../hooks/useAmbientSynth'
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
    incrementStudy: todayLog.incrementStudy,
    incrementBreak: todayLog.incrementBreak,
    addHistoryEntry: history.addEntry,
    playChime,
    createDatabaseSnapshot: backup.createDatabaseSnapshot,
    pushToast,
    activeTaskId,
    setActiveTaskId,
    focusNotificationsEnabled: settings.focusNotificationsEnabled,
  })

  const { controls: timerControls, display: timerDisplay } = engine

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
    isDataReady,
    pushToast,
  })

  const confirmImport = useCallback(async (fileString: string) => {
    const warn = timerControls.isTimerActive || timerControls.showReflectionModal
    const ok = await requestConfirm({
      title: warn ? 'Import during active session?' : 'Import backup?',
      message: warn
        ? 'Importing will replace all data and reload the page. An active timer or reflection is in progress.'
        : 'Importing will replace all workspace data. Continue?',
      confirmLabel: 'Import',
      danger: true,
    })
    if (!ok) return
    void backup.importStudyBackup(fileString)
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
