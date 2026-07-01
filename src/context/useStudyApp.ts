import { useMemo } from 'react'
import { useStudyDataContext } from './studyDataContext'
import { useStudyCore, useStudyGamification, useStudyExtended } from './studyDataSlices'
import { useStudyTimerContext, useStudyTimerDisplay } from './studyTimerContext'
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
  const core = useStudyCore()
  const gamification = useStudyGamification()
  const extended = useStudyExtended()
  return useMemo(() => ({
    ...core,
    ...gamification,
    ...extended,
  }), [core, gamification, extended])
}

export function useStudyUI() {
  const core = useStudyCore()
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
    isCommandPaletteOpen: ui.isCommandPaletteOpen,
    setIsCommandPaletteOpen: ui.setIsCommandPaletteOpen,
    focusNoteId: ui.focusNoteId,
    setFocusNoteId: ui.setFocusNoteId,
    pushToast: ui.pushToast,
    activeToast: ui.activeToast,
    quotaExceeded: ui.quotaExceeded,
    dismissQuotaRecovery: ui.dismissQuotaRecovery,
    isDragging: ui.isDragging,
    setIsDragging: ui.setIsDragging,
    activeTaskId: timerCtx.activeTaskId,
    setActiveTaskId: timerCtx.setActiveTaskId,
    taskCycleCount: timerCtx.taskCycleCount,
    setTaskCycleCount: timerCtx.setTaskCycleCount,
    activeThemeVars: ui.activeThemeVars,
    canvasRef: ui.canvasRef,
    progress: core.progress,
    notifyFocusLockout: ui.notifyFocusLockout,
    scheduleDelete: ui.scheduleDelete,
  }), [core.progress, timerCtx, ui])
}

export function useStudyTimer() {
  const timerCtx = useStudyTimerContext()
  const timerDisplay = useStudyTimerDisplay()
  return useMemo(() => ({
    timer: { ...timerCtx.timerControls, ...timerDisplay },
    ensureAudio: timerCtx.ensureAudio,
    handleAddTask: timerCtx.handleAddTask,
    handleToggleTask: timerCtx.handleToggleTask,
    activateTask: timerCtx.activateTask,
  }), [timerCtx, timerDisplay])
}

export function useStudyJournal() {
  const extended = useStudyExtended()
  const core = useStudyCore()
  return useMemo(() => ({
    journal: extended.journal,
    todayLog: core.todayLog,
  }), [extended.journal, core.todayLog])
}

export function useStudyAnalytics() {
  const gamification = useStudyGamification()
  const extended = useStudyExtended()
  return useMemo(() => ({
    currentStreak: gamification.currentStreak,
    xpData: gamification.xpData,
    insights: extended.insights,
    breakdownData: extended.breakdownData,
    analyticsRange: extended.analyticsRange,
    journal: extended.journal,
    allLogs: extended.allLogs,
  }), [gamification, extended])
}

export function useStudySettings() {
  const core = useStudyCore()
  const timerCtx = useStudyTimerContext()
  const ui = useStudyUIContext()
  const handleFileDrop = useMemo(
    () => (e: React.DragEvent) => ui.handleFileDrop(e, timerCtx.confirmImport),
    [ui, timerCtx.confirmImport],
  )
  return useMemo(() => ({
    settings: core.settings,
    backup: timerCtx.backup,
    confirmImport: timerCtx.confirmImport,
    handleFileDrop,
    categories: core.categories,
  }), [core.settings, core.categories, timerCtx.backup, timerCtx.confirmImport, handleFileDrop])
}
