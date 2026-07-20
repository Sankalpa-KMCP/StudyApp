export const DEFAULT_NOTE_TAG_COLORS = [
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#64748b',
] as const

export interface ParsedSettings {
  dailyGoalMinutes: number
  soundEnabled: boolean
  targetSessionsPerCycle: number
  longBreakDurationMinutes: number
  shortBreakDurationMinutes: number
  studyBlockDurationMinutes: number
  theme: string
  themePreset: string
  lightThemePreset: string
  ui_font: string
  uiDensity: 'comfortable' | 'compact'
  backdropSaturate: number
  cardBorderOpacity: number
  accentBlueOverride: string | null
  accentPurpleOverride: string | null
  accentGreenOverride: string | null
  accentAmberOverride: string | null
  noteTagColors: string[]
  recentHistoryLimit: number
  focusNotificationsEnabled: boolean
  cardOpacity: number
  backdropBlur: number
  reduceVisualEffects: boolean
  tactile_feedback: boolean
  developer_font: string
  enforce_lockout: boolean
  initialEasinessFactor: number
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
  syncEnabled: boolean
  lastSyncAt: string
  lastSyncChecksum: string
  ambientSoundEnabled: boolean
  ambientSoundPreset: 'rain' | 'white-noise' | 'cafe' | 'brown-noise'
  ambientVolume: number
  autoExportEnabled: boolean
  autoExportIntervalDays: number
  desktopAutostartEnabled: boolean
  desktopGlobalShortcutsEnabled: boolean
  desktopNativeNotificationsEnabled: boolean
  desktopBackupFolderPath: string
  historyRetentionDays: number
}

export const SETTINGS_DEFAULTS: ParsedSettings = {
  dailyGoalMinutes: 120,
  soundEnabled: true,
  targetSessionsPerCycle: 4,
  longBreakDurationMinutes: 15,
  shortBreakDurationMinutes: 5,
  studyBlockDurationMinutes: 25,
  theme: 'midnight-slate',
  themePreset: 'midnight-slate',
  lightThemePreset: 'paper-day',
  ui_font: 'Inter',
  uiDensity: 'comfortable',
  backdropSaturate: 180,
  cardBorderOpacity: 0.08,
  accentBlueOverride: null,
  accentPurpleOverride: null,
  accentGreenOverride: null,
  accentAmberOverride: null,
  noteTagColors: [...DEFAULT_NOTE_TAG_COLORS],
  recentHistoryLimit: 100,
  focusNotificationsEnabled: false,
  cardOpacity: 0.7,
  backdropBlur: 8,
  reduceVisualEffects: false,
  tactile_feedback: false,
  developer_font: 'JetBrains Mono',
  enforce_lockout: false,
  initialEasinessFactor: 2.5,
  autoArchiveAncientTasks: false,
  autoArchiveAfterDays: 90,
  lockoutMode: 'strict',
  lockoutAllowedTabs: '[]',
  lockoutStudyOnly: true,
  studyReminderEnabled: false,
  studyReminderTime: '15:00',
  studyReminderOnlyBelowGoal: true,
  schedulingAlgorithm: 'sm2',
  locale: 'en',
  desktopMinimizeOnCloseEnabled: false,
  desktopGlobalTimerShortcut: 'Space',
  syncFolderPath: '',
  syncEnabled: false,
  lastSyncAt: '',
  lastSyncChecksum: '',
  ambientSoundEnabled: false,
  ambientSoundPreset: 'rain',
  ambientVolume: 50,
  autoExportEnabled: false,
  autoExportIntervalDays: 7,
  desktopAutostartEnabled: false,
  desktopGlobalShortcutsEnabled: false,
  desktopNativeNotificationsEnabled: false,
  desktopBackupFolderPath: '',
  historyRetentionDays: 0,
}
