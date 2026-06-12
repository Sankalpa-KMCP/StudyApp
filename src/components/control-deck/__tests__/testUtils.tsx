/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { SettingsPanelProvider } from '../SettingsPanelContext'

vi.mock('../../../context/useConfirm', () => ({
  useConfirm: () => ({ requestConfirm: vi.fn().mockResolvedValue(false) }),
}))

vi.mock('../../../context/studyDataContext', () => ({
  useStudyDataContext: () => ({
    categories: {
      categories: [],
      addCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
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

vi.mock('../../../hooks/useSettingsUpdater', () => ({
  useSettingsUpdater: () => ({
    theme: 'midnight-slate',
    themePreset: 'midnight-slate',
    lightThemePreset: 'paper-day',
    ui_font: 'Inter',
    uiDensity: 'comfortable',
    cardOpacity: 0.7,
    backdropBlur: 8,
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
    focusNotificationsEnabled: false,
    soundEnabled: true,
    tactile_feedback: false,
    developer_font: 'JetBrains Mono',
    ambientSoundEnabled: false,
    ambientSoundPreset: 'rain' as const,
    enforce_lockout: false,
    autoArchiveAncientTasks: false,
    isLoading: false,
    updateSetting: mockUpdateSetting,
    updateSettingSafe: mockUpdateSetting,
    resetSectionDefaults: vi.fn(),
    resetKeys: vi.fn(),
  }),
}))

export function renderWithSettingsPanel(ui: ReactNode) {
  return ui
}

export { SettingsPanelProvider, mockUpdateSetting }
