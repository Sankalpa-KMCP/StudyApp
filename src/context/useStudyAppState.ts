import { useState, useEffect, useRef } from 'react'
import type { ActiveTab } from '../types/app'
import { useDashboardData } from '../hooks/useDashboardData'
import { useAppToast } from '../hooks/useAppToast'
import { useGamification } from '../hooks/useGamification'
import { useAnalytics } from '../hooks/useAnalytics'
import { useJournalCalendar } from '../hooks/useJournalCalendar'
import { useTaskActions } from '../hooks/useTaskActions'
import { useSessionBackup } from '../hooks/useSessionBackup'
import { useAmbientSynth } from '../hooks/useAmbientSynth'
import { useTimerEngine } from '../hooks/useTimerEngine'
import { useZenCanvas } from '../hooks/useZenCanvas'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { THEME_PROFILES } from '../lib/theme'

export function useStudyAppState() {
  const data = useDashboardData()
  const { activeToast, setActiveToast, pushToast } = useAppToast()

  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [breathTime, setBreathTime] = useState(0)
  const [isZenMode, setIsZenMode] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('focus')
  const [isDragging, setIsDragging] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [taskCycleCount, setTaskCycleCount] = useState(1)
  const [isHotkeyHudOpen, setIsHotkeyHudOpen] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const { tasks, history, settings, todayLog, flashcards, quickNotes, categories, allLogs, isDataReady } = data

  const { currentStreak, xpData } = useGamification({
    allLogs: allLogs.allLogs,
    isDataReady,
    pushToast,
  })

  const { insights, breakdownData } = useAnalytics({
    sessionHistory: history.history,
    sessionTasks: tasks.tasks,
    allLogs: allLogs.allLogs,
    categories: categories.categories,
  })

  const journal = useJournalCalendar({
    sessionHistory: history.history,
    sessionTasks: tasks.tasks,
    dailyGoalMinutes: settings.dailyGoalMinutes,
    studyBlockDurationMinutes: settings.studyBlockDurationMinutes,
    todayStudyMinutes: todayLog.studyMinutes,
    todayBreakMinutes: todayLog.breakMinutes,
  })

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

  useZenCanvas(isZenMode, canvasRef)

  useKeyboardShortcuts({
    activeTab,
    isHotkeyHudOpen,
    isTimerActive: timer.isTimerActive,
    timerMode: timer.timerMode,
    enforceLockout: settings.enforce_lockout,
    completingRef: timer.completingRef,
    handleModeSwitch: timer.handleModeSwitch,
    completeSession: timer.completeSession,
    setIsTimerActive: timer.setIsTimerActive,
    setIsZenMode,
    setIsHotkeyHudOpen,
    setActiveToast,
  })

  useEffect(() => {
    const interval = setInterval(() => setBreathTime(t => (t + 1) % 12), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--font-monospace', `'${settings.developer_font}', monospace`)
  }, [settings.developer_font])

  const progress = settings.dailyGoalMinutes > 0
    ? Math.min(todayLog.studyMinutes / settings.dailyGoalMinutes, 1)
    : 0

  const activeThemeVars = THEME_PROFILES[settings.theme] || THEME_PROFILES['midnight-oled']

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

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) {
      const r = new FileReader()
      r.onload = () => {
        if (typeof r.result === 'string') confirmImport(r.result)
      }
      r.readAsText(file)
    }
  }

  return {
    isDataReady,
    activeToast,
    isNotesOpen,
    setIsNotesOpen,
    breathTime,
    isZenMode,
    setIsZenMode,
    activeTab,
    setActiveTab,
    isDragging,
    setIsDragging,
    activeTaskId,
    setActiveTaskId,
    taskCycleCount,
    setTaskCycleCount,
    isHotkeyHudOpen,
    setIsHotkeyHudOpen,
    canvasRef,
    tasks,
    history,
    settings,
    todayLog,
    flashcards,
    quickNotes,
    categories,
    allLogs,
    currentStreak,
    xpData,
    insights,
    breakdownData,
    journal,
    backup,
    ensureAudio,
    timer,
    handleAddTask,
    handleToggleTask,
    progress,
    activeThemeVars,
    confirmImport,
    handleFileDrop,
  }
}
