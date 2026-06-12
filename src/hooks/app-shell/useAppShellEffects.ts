import { useEffect, useRef, useState } from 'react'
import { applySavedDesktopSettings, initDesktopTrayBridge, isTauri, setDesktopTrayTooltip } from '../../lib/desktop/tauri'
import { prefetchIdleTabChunks } from '../../lib/routing/prefetchTabChunks'
import { useStudyReminder } from '../useStudyReminder'
import { useAutoExport } from '../useAutoExport'

interface UseAppShellEffectsOptions {
  isDataReady: boolean
  flashcardsEnabled: boolean
  studyReminderEnabled: boolean
  studyReminderTime: string
  studyReminderOnlyBelowGoal: boolean
  dailyGoalMinutes: number
  todayStudyMinutes: number
  autoExportEnabled: boolean
  autoExportIntervalDays: number
  desktopAutostartEnabled: boolean
  desktopGlobalShortcutsEnabled: boolean
  exportBackup: () => void
  timerControls: {
    setIsTimerActive: React.Dispatch<React.SetStateAction<boolean>>
    isTimerActive: boolean
    timerMode: 'study' | 'break'
  }
  timerDisplay: {
    remainingSeconds: number
  }
}

export function useAppShellEffects({
  isDataReady,
  flashcardsEnabled,
  studyReminderEnabled,
  studyReminderTime,
  studyReminderOnlyBelowGoal,
  dailyGoalMinutes,
  todayStudyMinutes,
  autoExportEnabled,
  autoExportIntervalDays,
  desktopAutostartEnabled,
  desktopGlobalShortcutsEnabled,
  exportBackup,
  timerControls,
  timerDisplay,
}: UseAppShellEffectsOptions) {
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)

  useEffect(() => {
    const onOnline = () => setIsOffline(false)
    const onOffline = () => setIsOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useStudyReminder({
    enabled: studyReminderEnabled,
    reminderTime: studyReminderTime,
    onlyBelowGoal: studyReminderOnlyBelowGoal,
    dailyGoalMinutes,
    todayStudyMinutes,
    isDataReady,
  })

  useAutoExport({
    enabled: autoExportEnabled,
    intervalDays: autoExportIntervalDays,
    isDataReady,
    exportBackup,
  })

  const desktopSettingsAppliedRef = useRef(false)
  useEffect(() => {
    if (!isDataReady || !isTauri() || desktopSettingsAppliedRef.current) return
    desktopSettingsAppliedRef.current = true
    void applySavedDesktopSettings({
      desktopAutostartEnabled,
      desktopGlobalShortcutsEnabled,
    })
  }, [isDataReady, desktopAutostartEnabled, desktopGlobalShortcutsEnabled])

  useEffect(() => {
    void initDesktopTrayBridge()
    const onDesktopTimerToggle = () => {
      timerControls.setIsTimerActive(active => !active)
    }
    window.addEventListener('desktop-timer-toggle', onDesktopTimerToggle)
    return () => window.removeEventListener('desktop-timer-toggle', onDesktopTimerToggle)
  }, [timerControls])

  useEffect(() => {
    if (!isTauri()) return
    const mins = Math.floor(timerDisplay.remainingSeconds / 60)
    const secs = timerDisplay.remainingSeconds % 60
    const time = `${mins}:${secs.toString().padStart(2, '0')}`
    const mode = timerControls.timerMode === 'study' ? 'Focus' : 'Break'
    const state = timerControls.isTimerActive ? 'Running' : 'Paused'
    void setDesktopTrayTooltip(`Study Dashboard — ${mode} ${time} (${state})`)
  }, [
    timerDisplay.remainingSeconds,
    timerControls.isTimerActive,
    timerControls.timerMode,
  ])

  useEffect(() => {
    if (!isDataReady) return
    const id = window.requestIdleCallback
      ? window.requestIdleCallback(() => prefetchIdleTabChunks(flashcardsEnabled))
      : window.setTimeout(() => prefetchIdleTabChunks(flashcardsEnabled), 2000)
    return () => {
      if (typeof id === 'number') window.clearTimeout(id)
      else window.cancelIdleCallback?.(id)
    }
  }, [isDataReady, flashcardsEnabled])

  return { isOffline }
}
