import { useEffect, useRef, useState } from 'react'
import { applySavedDesktopSettings, initDesktopTrayBridge, isTauri } from '../../lib/desktop/tauri'
import { useStudyReminder } from '../useStudyReminder'
import { useAutoExport } from '../useAutoExport'
import { useFolderSync } from '../useFolderSync'

interface UseAppShellEffectsOptions {
  isDataReady: boolean
  studyReminderEnabled: boolean
  studyReminderTime: string
  studyReminderOnlyBelowGoal: boolean
  dailyGoalMinutes: number
  todayStudyMinutes: number
  autoExportEnabled: boolean
  autoExportIntervalDays: number
  syncEnabled: boolean
  syncFolderPath: string
  desktopAutostartEnabled: boolean
  desktopGlobalShortcutsEnabled: boolean
  exportBackup: () => void
  timerControls: {
    setIsTimerActive: React.Dispatch<React.SetStateAction<boolean>>
  }
}

export function useAppShellEffects({
  isDataReady,
  studyReminderEnabled,
  studyReminderTime,
  studyReminderOnlyBelowGoal,
  dailyGoalMinutes,
  todayStudyMinutes,
  autoExportEnabled,
  autoExportIntervalDays,
  syncEnabled,
  syncFolderPath,
  desktopAutostartEnabled,
  desktopGlobalShortcutsEnabled,
  exportBackup,
  timerControls,
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

  useFolderSync({
    syncEnabled,
    syncFolderPath,
    isDataReady,
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

  return { isOffline }
}
