import { useMemo, useState } from 'react'
import { useSessionBackup } from '../hooks/useSessionBackup'
import { useAmbientSynth } from '../hooks/useAmbientSynth'
import { useTimerEngine } from '../hooks/useTimerEngine'
import { useTaskActions } from '../hooks/useTaskActions'
import { useStudyDataContext } from './studyDataContext'
import type { useAppToast } from '../hooks/useAppToast'

type PushToast = ReturnType<typeof useAppToast>['pushToast']

export function useStudyTimerState(pushToast: PushToast) {
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

  const timer = useTimerEngine({
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
  })

  const { handleAddTask, handleToggleTask } = useTaskActions({
    sessionTasks: tasks.tasks,
    addTask: tasks.addTask,
    toggleTask: tasks.toggleTask,
    playChime,
    activeTaskId,
    setActiveTaskId,
    taskCycleCount,
    autoArchiveAncientTasks: settings.autoArchiveAncientTasks,
    isDataReady,
    pushToast,
  })

  function confirmImport(fileString: string) {
    const warn = timer.isTimerActive || timer.showReflectionModal
    if (warn && !confirm('Importing will replace all data and reload the page. An active timer or reflection is in progress. Continue?')) {
      return
    }
    if (!warn && !confirm('Importing will replace all workspace data. Continue?')) {
      return
    }
    void backup.importStudyBackup(fileString)
  }

  return useMemo(() => ({
    backup,
    timer,
    ensureAudio,
    handleAddTask,
    handleToggleTask,
    activeTaskId,
    setActiveTaskId,
    taskCycleCount,
    setTaskCycleCount,
    confirmImport,
  }), [
    backup,
    timer,
    ensureAudio,
    handleAddTask,
    handleToggleTask,
    activeTaskId,
    taskCycleCount,
    confirmImport,
  ])
}
