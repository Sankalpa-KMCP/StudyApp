import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoriesPanel } from '../CategoriesPanel'
import { SettingsPanelProvider } from '../SettingsPanelContext'

const requestConfirm = vi.fn()
const pushToast = vi.fn()
const deleteCategory = vi.fn()

vi.mock('../../../context/useConfirm', () => ({
  useConfirm: () => ({ requestConfirm }),
}))

vi.mock('../../../context/studyDataContext', () => ({
  useStudyDataContext: () => ({
    categories: {
      categories: [{ id: 1, name: 'Math', color: '#3B82F6' }],
      addCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory,
    },
  }),
}))

vi.mock('../../../context/studyTimerContext', () => ({
  useStudyTimerContext: () => ({
    confirmImport: vi.fn(),
    backup: {
      exportStudyBackup: vi.fn(),
      fileInputRef: { current: null },
      resetData: vi.fn(),
      resetDataSelective: vi.fn(),
      clearSnapshots: vi.fn(),
      exportStudyLogsCSV: vi.fn(),
      exportTaskCompletionLogsCSV: vi.fn(),
    },
  }),
}))

vi.mock('../../../context/studyUIContext', () => ({
  useStudyUIContext: () => ({
    pushToast,
    isDragging: false,
    setIsDragging: vi.fn(),
    quotaExceeded: false,
    handleFileDrop: vi.fn(),
  }),
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
    backdropSaturate: 180,
    cardBorderOpacity: 0.08,
    accentBlueOverride: null,
    accentPurpleOverride: null,
    accentGreenOverride: null,
    accentAmberOverride: null,
    noteTagColors: [],
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
    enforce_lockout: false,
    autoArchiveAncientTasks: false,
    isLoading: false,
    updateSetting: vi.fn(),
    updateSettingSafe: vi.fn(),
    resetSectionDefaults: vi.fn(),
    resetKeys: vi.fn(),
  }),
}))

describe('CategoriesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requestConfirm.mockResolvedValue(true)
    deleteCategory.mockResolvedValue(undefined)
  })

  it('uses confirm dialog instead of alert on delete', async () => {
    const user = userEvent.setup()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(
      <SettingsPanelProvider>
        <CategoriesPanel />
      </SettingsPanelProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Show' }))
    await user.click(screen.getByRole('button', { name: /delete category math/i }))

    expect(requestConfirm).toHaveBeenCalled()
    expect(alertSpy).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })
})
