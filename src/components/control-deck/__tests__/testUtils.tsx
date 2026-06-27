/* eslint-disable react-refresh/only-export-components */
import { vi } from 'vitest'
import type { CategoryItem } from '../../../db/types'
import { SettingsPanelProvider } from '../../../context/settingsPanelContext'

const mockRequestConfirm = vi.hoisted(() => vi.fn().mockResolvedValue(false))
const mockStudyCategories = vi.hoisted(() => ({
  categories: [] as CategoryItem[],
  deleteCategory: vi.fn(),
}))

vi.mock('../../../context/useConfirm', () => ({
  useConfirm: () => ({ requestConfirm: mockRequestConfirm }),
}))

vi.mock('../../../context/useStudyApp', () => ({
  useStudyData: () => ({
    categories: {
      categories: mockStudyCategories.categories,
      addCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: mockStudyCategories.deleteCategory,
    },
  }),
}))

vi.mock('../../../context/studyTimerContext', () => ({
  useStudyTimerContext: () => ({
    confirmImport: vi.fn(),
    backup: {
      exportStudyBackup: vi.fn(),
      isExporting: false,
      exportProgress: 0,
      exportStudyLogsCSV: vi.fn(),
      exportTaskCompletionLogsCSV: vi.fn(),
      archiveHistoryOlderThan: vi.fn().mockResolvedValue(0),
      importStudyBackup: vi.fn(),
      resetData: vi.fn(),
      resetDataSelective: vi.fn(),
      clearSnapshots: vi.fn(),
      fileInputRef: { current: null },
    },
  }),
}))

vi.mock('../../../context/studyUIContext', () => ({
  useStudyUIContext: () => ({
    pushToast: vi.fn(),
    isDragging: false,
    setIsDragging: vi.fn(),
    quotaExceeded: false,
    handleFileDrop: vi.fn(),
  }),
}))

const mockUpdateSetting = vi.fn().mockResolvedValue(true)

vi.mock('../../../hooks/useStorageEstimate', () => ({
  useStorageEstimate: () => ({
    usageBytes: 1024,
    quotaBytes: 1024 * 1024,
    rowCounts: {
      tasks: 1,
      history: 2,
      dailyLogs: 3,
      quickNotes: 4,
      categories: 5,
      snapshots: 0,
    },
    isLoading: false,
    isSupported: true,
  }),
  formatBytes: (bytes: number) => `${bytes} B`,
}))

vi.mock('../../../hooks/useSettingsUpdater', () => ({
  useSettingsUpdater: () => ({
    theme: 'midnight-slate',
    themePreset: 'midnight-slate',
    lightThemePreset: 'paper-day',
    ui_font: 'Inter',
    uiDensity: 'comfortable',
    cardOpacity: 0.7,
    backdropBlur: 8,
    reduceVisualEffects: false,
    backdropSaturate: 180,
    cardBorderOpacity: 0.08,
    accentBlueOverride: '#ff0000',
    accentPurpleOverride: null,
    accentGreenOverride: null,
    accentAmberOverride: null,
    noteTagColors: ['#06b6d4'],
    initialEasinessFactor: 2.5,
    dailyGoalMinutes: 120,
    studyBlockDurationMinutes: 25,
    shortBreakDurationMinutes: 5,
    longBreakDurationMinutes: 15,
    targetSessionsPerCycle: 4,
    recentHistoryLimit: 100,
    historyRetentionDays: 0,
    autoExportEnabled: false,
    autoExportIntervalDays: 7,
    desktopAutostartEnabled: false,
    desktopGlobalShortcutsEnabled: false,
    desktopNativeNotificationsEnabled: false,
    focusNotificationsEnabled: false,
    soundEnabled: true,
    tactile_feedback: false,
    developer_font: 'JetBrains Mono',
    ambientSoundEnabled: false,
    ambientSoundPreset: 'rain' as const,
    ambientVolume: 50,
    enforce_lockout: false,
    autoArchiveAncientTasks: false,
    autoArchiveAfterDays: 90,
    lockoutMode: 'strict' as const,
    lockoutAllowedTabs: '[]',
    lockoutStudyOnly: true,
    studyReminderEnabled: false,
    studyReminderTime: '15:00',
    studyReminderOnlyBelowGoal: true,
    schedulingAlgorithm: 'sm2' as const,
    locale: 'en',
    desktopMinimizeOnCloseEnabled: false,
    desktopGlobalTimerShortcut: 'Space',
    syncFolderPath: '',
    syncEnabled: false,
    updateSetting: mockUpdateSetting,
    updateSettingSafe: mockUpdateSetting,
    resetSectionDefaults: vi.fn(),
    resetKeys: vi.fn(),
  }),
}))

export { SettingsPanelProvider, mockRequestConfirm, mockStudyCategories, mockUpdateSetting }
