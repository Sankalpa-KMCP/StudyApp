import { useContext } from 'react'
import { StudyAppContext } from './studyAppContext'

export function useStudyApp() {
  const ctx = useContext(StudyAppContext)
  if (!ctx) throw new Error('useStudyApp must be used within StudyAppProvider')
  return ctx
}

export function useStudyData() {
  const { tasks, history, settings, todayLog, flashcards, quickNotes, categories, allLogs, isDataReady } = useStudyApp()
  return { tasks, history, settings, todayLog, flashcards, quickNotes, categories, allLogs, isDataReady }
}

export function useStudyUI() {
  const {
    activeTab, setActiveTab, isZenMode, setIsZenMode, isNotesOpen, setIsNotesOpen,
    isHotkeyHudOpen, setIsHotkeyHudOpen, activeToast, breathTime, isDragging, setIsDragging,
    activeTaskId, setActiveTaskId, taskCycleCount, setTaskCycleCount, activeThemeVars, progress,
  } = useStudyApp()
  return {
    activeTab, setActiveTab, isZenMode, setIsZenMode, isNotesOpen, setIsNotesOpen,
    isHotkeyHudOpen, setIsHotkeyHudOpen, activeToast, breathTime, isDragging, setIsDragging,
    activeTaskId, setActiveTaskId, taskCycleCount, setTaskCycleCount, activeThemeVars, progress,
  }
}

export function useStudyTimer() {
  const { timer, ensureAudio, handleAddTask, handleToggleTask } = useStudyApp()
  return { timer, ensureAudio, handleAddTask, handleToggleTask }
}

export function useStudyJournal() {
  const { journal, todayLog } = useStudyApp()
  return { journal, todayLog }
}

export function useStudyAnalytics() {
  const { currentStreak, xpData, insights, breakdownData, journal, allLogs } = useStudyApp()
  return { currentStreak, xpData, insights, breakdownData, journal, allLogs }
}

export function useStudySettings() {
  const { settings, backup, confirmImport, handleFileDrop, categories } = useStudyApp()
  return { settings, backup, confirmImport, handleFileDrop, categories }
}
