import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppShell } from '../AppShell'

vi.mock('../../context/useStudyApp', () => ({
  useStudyData: () => ({
    isDataReady: false,
    tasks: { tasks: [] },
    settings: {
      dailyGoalMinutes: 120,
      enforce_lockout: false,
      cardOpacity: 0.7,
      backdropBlur: 8,
      backdropSaturate: 180,
      cardBorderOpacity: 0.08,
      noteTagColors: [],
      uiDensity: 'comfortable',
      flashcardsEnabled: false,
      reduceVisualEffects: false,
      autoExportEnabled: false,
      autoExportIntervalDays: 7,
      desktopAutostartEnabled: false,
      desktopGlobalShortcutsEnabled: false,
    },
    quickNotes: { notes: [], deleteNote: vi.fn(), addNote: vi.fn(), updateNote: vi.fn() },
    categories: { categories: [], addCategory: vi.fn(), deleteCategory: vi.fn() },
    currentStreak: 0,
    xpData: { level: 1, xpProgressPercent: 0 },
    todayLog: { studyMinutes: 0 },
    flashcards: { flashcards: [] },
    recentHistory: { history: [] },
  }),
  useStudyUI: () => ({
    activeTab: 'focus',
    setActiveTab: vi.fn(),
    isZenMode: false,
    setIsZenMode: vi.fn(),
    isHotkeyHudOpen: false,
    setIsHotkeyHudOpen: vi.fn(),
    activeTaskId: null,
    activeThemeVars: { pageGradient: 'linear-gradient(#000,#111)' },
    canvasRef: { current: null },
    activeToast: null,
    quotaExceeded: false,
    dismissQuotaRecovery: vi.fn(),
    isNotesOpen: false,
    setIsNotesOpen: vi.fn(),
    isCommandPaletteOpen: false,
    setIsCommandPaletteOpen: vi.fn(),
    focusNoteId: null,
    setFocusNoteId: vi.fn(),
    scheduleDelete: vi.fn(),
  }),
}))

vi.mock('../../context/studyTimerContext', () => ({
  useStudyTimerContext: () => ({
    timerControls: {
      isTimerActive: false,
      timerMode: 'study',
      setIsTimerActive: vi.fn(),
      timerCategoryId: undefined,
    },
    backup: { exportStudyBackup: vi.fn() },
    activateTask: vi.fn(),
  }),
  useStudyTimerDisplay: () => ({
    remainingSeconds: 1500,
    secondsElapsed: 0,
    targetSeconds: 1500,
    progress: 0,
  }),
}))

vi.mock('../../hooks/usePwaInstall', () => ({
  usePwaInstall: () => ({ showBanner: false, install: vi.fn(), dismiss: vi.fn() }),
}))

vi.mock('../../context/useConfirm', () => ({
  useConfirm: () => ({ requestConfirm: vi.fn().mockResolvedValue(false) }),
}))

describe('AppShell', () => {
  it('renders loading screen when data is not ready', () => {
    render(<AppShell />)
    expect(screen.getByText('Loading Study Dashboard')).toBeInTheDocument()
  })
})
