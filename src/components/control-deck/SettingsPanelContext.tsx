/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { CategoryItem, SettingsKey, SettingsValue } from '../../db/types'
import { useStudyDataContext } from '../../context/studyDataContext'
import { useStudyTimerContext } from '../../context/studyTimerContext'
import { useStudyUIContext } from '../../context/studyUIContext'
import { useSettingsUpdater } from '../../hooks/useSettingsUpdater'
import type { StudyBackupExportOptions } from '../../hooks/useSessionBackup'

export interface SettingsBackupApi {
  exportStudyBackup: (options?: StudyBackupExportOptions) => void
  shareStudyBackupVault?: () => void
  exportStudyHistoryIcs?: () => void
  canShareBackup?: boolean
  isExporting?: boolean
  exportProgress?: number
  exportStudyLogsCSV: () => void
  exportTaskCompletionLogsCSV: () => void
  importStudyBackup: (val: string, options?: { mode?: 'replace' | 'merge'; passphrase?: string }) => void
  importStudyHistoryIcs?: (val: string) => void
  resetData: () => void
  resetDataSelective: (options: {
    tasks: boolean
    history: boolean
    categories: boolean
    cards: boolean
    notes: boolean
  }) => void
  clearSnapshots: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
}

export interface SettingsCategoriesApi {
  categories: CategoryItem[]
  addCategory: (name: string, color: string, dailyGoalMinutes?: number) => void | Promise<number>
  updateCategory: (id: number, updates: { name?: string; color?: string; dailyGoalMinutes?: number }) => void | Promise<void>
  deleteCategory: (id: number) => void
}

interface SettingsPanelContextValue {
  updateSetting: (key: SettingsKey, val: SettingsValue) => void | Promise<boolean>
  updateSettingSafe: (key: SettingsKey, val: SettingsValue, options?: { silent?: boolean }) => Promise<boolean>
  resetSectionDefaults: (sectionId: import('../../lib/settings/settingsSections').SettingsSectionId) => Promise<boolean>
  resetKeys: (keys: SettingsKey[], successMessage: string) => Promise<boolean>
  isLoading: boolean
  theme: string
  themePreset: string
  lightThemePreset: string
  ui_font: string
  uiDensity: 'comfortable' | 'compact'
  cardOpacity: number
  backdropBlur: number
  backdropSaturate: number
  cardBorderOpacity: number
  accentBlueOverride: string | null
  accentPurpleOverride: string | null
  accentGreenOverride: string | null
  accentAmberOverride: string | null
  noteTagColors: string[]
  initialEasinessFactor: number
  dailyGoalMinutes: number
  studyBlockDurationMinutes: number
  shortBreakDurationMinutes: number
  longBreakDurationMinutes: number
  targetSessionsPerCycle: number
  recentHistoryLimit: number
  focusNotificationsEnabled: boolean
  soundEnabled: boolean
  tactile_feedback: boolean
  developer_font: string
  enforce_lockout: boolean
  autoArchiveAncientTasks: boolean
  autoArchiveAfterDays: number
  lockoutMode: 'strict' | 'soft'
  lockoutAllowedTabs: string
  lockoutStudyOnly: boolean
  studyReminderEnabled: boolean
  studyReminderTime: string
  studyReminderOnlyBelowGoal: boolean
  schedulingAlgorithm: 'sm2' | 'fsrs'
  locale: string
  desktopMinimizeOnCloseEnabled: boolean
  desktopGlobalTimerShortcut: string
  syncFolderPath: string
  ambientSoundEnabled: boolean
  ambientSoundPreset: 'rain' | 'white-noise' | 'cafe' | 'brown-noise'
  ambientVolume: number
  historyRetentionDays: number
  autoExportEnabled: boolean
  autoExportIntervalDays: number
  desktopAutostartEnabled: boolean
  desktopGlobalShortcutsEnabled: boolean
  desktopNativeNotificationsEnabled: boolean
  desktopBackupFolderPath: string
  flashcardsEnabled: boolean
  backup: SettingsBackupApi
  categories: SettingsCategoriesApi
  isDragging: boolean
  setIsDragging: (val: boolean) => void
  quotaExceeded: boolean
  handleFileDrop: (e: React.DragEvent) => void
  pushToast: (key: string, message: string) => void
}

const SettingsPanelContext = createContext<SettingsPanelContextValue | null>(null)

export function SettingsPanelProvider({ children }: { children: ReactNode }) {
  const { pushToast, isDragging, setIsDragging, quotaExceeded, handleFileDrop: uiHandleFileDrop } = useStudyUIContext()
  const { categories } = useStudyDataContext()
  const timerCtx = useStudyTimerContext()
  const updater = useSettingsUpdater(pushToast)

  const handleFileDrop = useMemo(
    () => (e: React.DragEvent) => uiHandleFileDrop(e, timerCtx.confirmImport),
    [uiHandleFileDrop, timerCtx.confirmImport],
  )

  const value = useMemo<SettingsPanelContextValue>(() => ({
    theme: updater.theme,
    themePreset: updater.themePreset,
    lightThemePreset: updater.lightThemePreset,
    ui_font: updater.ui_font,
    uiDensity: updater.uiDensity,
    cardOpacity: updater.cardOpacity,
    backdropBlur: updater.backdropBlur,
    backdropSaturate: updater.backdropSaturate,
    cardBorderOpacity: updater.cardBorderOpacity,
    accentBlueOverride: updater.accentBlueOverride,
    accentPurpleOverride: updater.accentPurpleOverride,
    accentGreenOverride: updater.accentGreenOverride,
    accentAmberOverride: updater.accentAmberOverride,
    noteTagColors: updater.noteTagColors,
    initialEasinessFactor: updater.initialEasinessFactor,
    dailyGoalMinutes: updater.dailyGoalMinutes,
    studyBlockDurationMinutes: updater.studyBlockDurationMinutes,
    shortBreakDurationMinutes: updater.shortBreakDurationMinutes,
    longBreakDurationMinutes: updater.longBreakDurationMinutes,
    targetSessionsPerCycle: updater.targetSessionsPerCycle,
    recentHistoryLimit: updater.recentHistoryLimit,
    focusNotificationsEnabled: updater.focusNotificationsEnabled,
    soundEnabled: updater.soundEnabled,
    tactile_feedback: updater.tactile_feedback,
    developer_font: updater.developer_font,
    enforce_lockout: updater.enforce_lockout,
    autoArchiveAncientTasks: updater.autoArchiveAncientTasks,
    autoArchiveAfterDays: updater.autoArchiveAfterDays,
    lockoutMode: updater.lockoutMode,
    lockoutAllowedTabs: updater.lockoutAllowedTabs,
    lockoutStudyOnly: updater.lockoutStudyOnly,
    studyReminderEnabled: updater.studyReminderEnabled,
    studyReminderTime: updater.studyReminderTime,
    studyReminderOnlyBelowGoal: updater.studyReminderOnlyBelowGoal,
    schedulingAlgorithm: updater.schedulingAlgorithm,
    locale: updater.locale,
    desktopMinimizeOnCloseEnabled: updater.desktopMinimizeOnCloseEnabled,
    desktopGlobalTimerShortcut: updater.desktopGlobalTimerShortcut,
    syncFolderPath: updater.syncFolderPath,
    ambientSoundEnabled: updater.ambientSoundEnabled,
    ambientSoundPreset: updater.ambientSoundPreset,
    ambientVolume: updater.ambientVolume,
    historyRetentionDays: updater.historyRetentionDays,
    autoExportEnabled: updater.autoExportEnabled,
    autoExportIntervalDays: updater.autoExportIntervalDays,
    desktopAutostartEnabled: updater.desktopAutostartEnabled,
    desktopGlobalShortcutsEnabled: updater.desktopGlobalShortcutsEnabled,
    desktopNativeNotificationsEnabled: updater.desktopNativeNotificationsEnabled,
    desktopBackupFolderPath: updater.desktopBackupFolderPath,
    flashcardsEnabled: updater.flashcardsEnabled,
    isLoading: updater.isLoading,
    updateSetting: (key, val) => { void updater.updateSettingSafe(key, val) },
    updateSettingSafe: updater.updateSettingSafe,
    resetSectionDefaults: updater.resetSectionDefaults,
    resetKeys: updater.resetKeys,
    pushToast,
    backup: {
      exportStudyBackup: timerCtx.backup.exportStudyBackup,
      shareStudyBackupVault: timerCtx.backup.shareStudyBackupVault,
      exportStudyHistoryIcs: timerCtx.backup.exportStudyHistoryIcs,
      canShareBackup: timerCtx.backup.canShareBackup,
      isExporting: timerCtx.backup.isExporting,
      exportProgress: timerCtx.backup.exportProgress,
      exportStudyLogsCSV: timerCtx.backup.exportStudyLogsCSV,
      exportTaskCompletionLogsCSV: timerCtx.backup.exportTaskCompletionLogsCSV,
      importStudyBackup: timerCtx.confirmImport,
      importStudyHistoryIcs: (val: string) => { void timerCtx.backup.importStudyHistoryIcs(val) },
      resetData: timerCtx.backup.resetData,
      resetDataSelective: timerCtx.backup.resetDataSelective,
      clearSnapshots: timerCtx.backup.clearSnapshots,
      fileInputRef: timerCtx.backup.fileInputRef,
    },
    categories: {
      categories: categories.categories,
      addCategory: categories.addCategory,
      updateCategory: categories.updateCategory,
      deleteCategory: categories.deleteCategory,
    },
    isDragging,
    setIsDragging,
    quotaExceeded,
    handleFileDrop,
  }), [updater, pushToast, timerCtx, categories, isDragging, setIsDragging, quotaExceeded, handleFileDrop])

  return (
    <SettingsPanelContext.Provider value={value}>
      {children}
    </SettingsPanelContext.Provider>
  )
}

export function useSettingsPanel() {
  const ctx = useContext(SettingsPanelContext)
  if (!ctx) throw new Error('useSettingsPanel must be used within SettingsPanelProvider')
  return ctx
}
