import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { StudyTimerContext, StudyTimerDisplayContext } from './studyTimerContext'
import { useStudyTimerState } from './useStudyTimerState'
import type { useAppToast } from '../hooks/useAppToast'

type PushToast = ReturnType<typeof useAppToast>['pushToast']

export function StudyTimerProvider({ children, pushToast }: { children: ReactNode; pushToast: PushToast }) {
  const state = useStudyTimerState(pushToast)

  const shellValue = useMemo(() => ({
    backup: state.backup,
    timerControls: state.timerControls,
    ensureAudio: state.ensureAudio,
    handleAddTask: state.handleAddTask,
    handleToggleTask: state.handleToggleTask,
    activateTask: state.activateTask,
    activeTaskId: state.activeTaskId,
    setActiveTaskId: state.setActiveTaskId,
    taskCycleCount: state.taskCycleCount,
    setTaskCycleCount: state.setTaskCycleCount,
    confirmImport: state.confirmImport,
  }), [
    state.backup,
    state.timerControls,
    state.ensureAudio,
    state.handleAddTask,
    state.handleToggleTask,
    state.activateTask,
    state.activeTaskId,
    state.setActiveTaskId,
    state.taskCycleCount,
    state.setTaskCycleCount,
    state.confirmImport,
  ])

  return (
    <StudyTimerContext.Provider value={shellValue}>
      <StudyTimerDisplayContext.Provider value={state.timerDisplay}>
        {children}
      </StudyTimerDisplayContext.Provider>
    </StudyTimerContext.Provider>
  )
}
