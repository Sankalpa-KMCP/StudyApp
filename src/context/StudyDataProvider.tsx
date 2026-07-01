import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useActiveTabSync } from '../lib/routing/activeTabSync'
import { useDeferredDataFlags } from '../hooks/useDeferredDataEnabled'
import { StudyDataContext } from './studyDataContext'
import {
  StudyCoreContext,
  StudyGamificationContext,
  StudyExtendedContext,
} from './studyDataSlices'
import { useStudyDataState } from './useStudyDataState'

export function StudyDataProvider({ children }: { children: ReactNode }) {
  const activeTab = useActiveTabSync()
  const { notesEnabled, fullLogsEnabled } = useDeferredDataFlags()
  const state = useStudyDataState(activeTab, { notesEnabled, fullLogsEnabled })

  const coreValue = useMemo(() => ({
    isDataReady: state.isDataReady,
    tasks: state.tasks,
    history: state.history,
    recentHistory: state.recentHistory,
    settings: state.settings,
    todayLog: state.todayLog,
    categories: state.categories,
    progress: state.progress,
  }), [
    state.isDataReady,
    state.tasks,
    state.history,
    state.recentHistory,
    state.settings,
    state.todayLog,
    state.categories,
    state.progress,
  ])

  const gamificationValue = useMemo(() => ({
    currentStreak: state.currentStreak,
    xpData: state.xpData,
    pendingLevelUp: state.pendingLevelUp,
    dismissLevelUp: state.dismissLevelUp,
  }), [state.currentStreak, state.xpData, state.pendingLevelUp, state.dismissLevelUp])

  const extendedValue = useMemo(() => ({
    flashcards: state.flashcards,
    quickNotes: state.quickNotes,
    allLogs: state.allLogs,
    insights: state.insights,
    breakdownData: state.breakdownData,
    analyticsRange: state.analyticsRange,
    journal: state.journal,
  }), [
    state.flashcards,
    state.quickNotes,
    state.allLogs,
    state.insights,
    state.breakdownData,
    state.analyticsRange,
    state.journal,
  ])

  return (
    <StudyDataContext.Provider value={state}>
      <StudyCoreContext.Provider value={coreValue}>
        <StudyGamificationContext.Provider value={gamificationValue}>
          <StudyExtendedContext.Provider value={extendedValue}>
            {children}
          </StudyExtendedContext.Provider>
        </StudyGamificationContext.Provider>
      </StudyCoreContext.Provider>
    </StudyDataContext.Provider>
  )
}
