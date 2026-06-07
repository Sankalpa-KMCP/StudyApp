import { useMemo } from 'react'
import { useStudyDataContext } from './studyDataContext'
import { useStudyTimerContext } from './studyTimerContext'
import { useStudyUIContext } from './studyUIContext'

export function useStudyApp() {
  const data = useStudyDataContext()
  const timerCtx = useStudyTimerContext()
  const ui = useStudyUIContext()

  const handleFileDrop = useMemo(
    () => (e: React.DragEvent) => ui.handleFileDrop(e, timerCtx.confirmImport),
    [ui, timerCtx.confirmImport],
  )

  return {
    ...data,
    ...timerCtx,
    ...ui,
    handleFileDrop,
  }
}

export function useStudyData() {
  const ctx = useStudyDataContext()
  return useMemo(() => ({
    tasks: ctx.tasks,
    history: ctx.history,
    recentHistory: ctx.recentHistory,
    settings: ctx.settings,
    todayLog: ctx.todayLog,
    flashcards: ctx.flashcards,
    quickNotes: ctx.quickNotes,
    categories: ctx.categories,
    allLogs: ctx.allLogs,
    isDataReady: ctx.isDataReady,
    currentStreak: ctx.currentStreak,
    xpData: ctx.xpData,
  }), [ctx])
}

export function useStudyUI() {
  const data = useStudyDataContext()
  const timerCtx = useStudyTimerContext()
  const ui = useStudyUIContext()
  return useMemo(() => ({
    activeTab: ui.activeTab,
    setActiveTab: ui.setActiveTab,
    isZenMode: ui.isZenMode,
    setIsZenMode: ui.setIsZenMode,
    isNotesOpen: ui.isNotesOpen,
    setIsNotesOpen: ui.setIsNotesOpen,
    isHotkeyHudOpen: ui.isHotkeyHudOpen,
    setIsHotkeyHudOpen: ui.setIsHotkeyHudOpen,
    activeToast: ui.activeToast,
    breathTime: ui.breathTime,
    isDragging: ui.isDragging,
    setIsDragging: ui.setIsDragging,
    activeTaskId: timerCtx.activeTaskId,
    setActiveTaskId: timerCtx.setActiveTaskId,
    taskCycleCount: timerCtx.taskCycleCount,
    setTaskCycleCount: timerCtx.setTaskCycleCount,
    activeThemeVars: ui.activeThemeVars,
    canvasRef: ui.canvasRef,
    progress: data.progress,
  }), [data.progress, timerCtx, ui])
}

export function useStudyTimer() {
  const timerCtx = useStudyTimerContext()
  return useMemo(() => ({
    timer: timerCtx.timer,
    ensureAudio: timerCtx.ensureAudio,
    handleAddTask: timerCtx.handleAddTask,
    handleToggleTask: timerCtx.handleToggleTask,
  }), [timerCtx])
}

export function useStudyJournal() {
  const data = useStudyDataContext()
  return useMemo(() => ({
    journal: data.journal,
    todayLog: data.todayLog,
  }), [data.journal, data.todayLog])
}

export function useStudyAnalytics() {
  const data = useStudyDataContext()
  return useMemo(() => ({
    currentStreak: data.currentStreak,
    xpData: data.xpData,
    insights: data.insights,
    breakdownData: data.breakdownData,
    journal: data.journal,
    allLogs: data.allLogs,
  }), [data])
}

export function useStudySettings() {
  const data = useStudyDataContext()
  const timerCtx = useStudyTimerContext()
  const ui = useStudyUIContext()
  const handleFileDrop = useMemo(
    () => (e: React.DragEvent) => ui.handleFileDrop(e, timerCtx.confirmImport),
    [ui, timerCtx.confirmImport],
  )
  return useMemo(() => ({
    settings: data.settings,
    backup: timerCtx.backup,
    confirmImport: timerCtx.confirmImport,
    handleFileDrop,
    categories: data.categories,
  }), [data.settings, data.categories, timerCtx.backup, timerCtx.confirmImport, handleFileDrop])
}
