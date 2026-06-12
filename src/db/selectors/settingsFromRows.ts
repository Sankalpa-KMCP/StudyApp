import type { SettingsKey, SettingsRow, SettingsValue } from '../types'

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
  flashcardsEnabled: boolean
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
  flashcardsEnabled: false,
}

function parseNoteTagColors(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...DEFAULT_NOTE_TAG_COLORS]
    const colors = parsed.filter((c): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c))
    return colors.length > 0 ? colors.slice(0, 8) : [...DEFAULT_NOTE_TAG_COLORS]
  } catch {
    return [...DEFAULT_NOTE_TAG_COLORS]
  }
}

function getValue<K extends keyof ParsedSettings>(
  rows: SettingsRow[] | undefined,
  key: SettingsKey,
  fallback: ParsedSettings[K],
): ParsedSettings[K] {
  const row = rows?.find(r => r.key === key)
  if (row?.value === null || row?.value === undefined) return fallback
  return row.value as ParsedSettings[K]
}

export function settingsFromRows(rows: SettingsRow[] | undefined): ParsedSettings {
  return {
    dailyGoalMinutes: getValue(rows, 'dailyGoalMinutes', SETTINGS_DEFAULTS.dailyGoalMinutes),
    soundEnabled: getValue(rows, 'soundEnabled', SETTINGS_DEFAULTS.soundEnabled),
    targetSessionsPerCycle: getValue(rows, 'targetSessionsPerCycle', SETTINGS_DEFAULTS.targetSessionsPerCycle),
    longBreakDurationMinutes: getValue(rows, 'longBreakDurationMinutes', SETTINGS_DEFAULTS.longBreakDurationMinutes),
    shortBreakDurationMinutes: getValue(rows, 'shortBreakDurationMinutes', SETTINGS_DEFAULTS.shortBreakDurationMinutes),
    studyBlockDurationMinutes: getValue(rows, 'studyBlockDurationMinutes', SETTINGS_DEFAULTS.studyBlockDurationMinutes),
    theme: getValue(rows, 'theme', SETTINGS_DEFAULTS.theme),
    themePreset: getValue(rows, 'themePreset', SETTINGS_DEFAULTS.themePreset),
    lightThemePreset: getValue(rows, 'lightThemePreset', SETTINGS_DEFAULTS.lightThemePreset),
    ui_font: getValue(rows, 'ui_font', SETTINGS_DEFAULTS.ui_font),
    uiDensity: getValue(rows, 'uiDensity', SETTINGS_DEFAULTS.uiDensity),
    backdropSaturate: getValue(rows, 'backdropSaturate', SETTINGS_DEFAULTS.backdropSaturate),
    cardBorderOpacity: getValue(rows, 'cardBorderOpacity', SETTINGS_DEFAULTS.cardBorderOpacity),
    accentBlueOverride: getValue(rows, 'accentBlueOverride', SETTINGS_DEFAULTS.accentBlueOverride),
    accentPurpleOverride: getValue(rows, 'accentPurpleOverride', SETTINGS_DEFAULTS.accentPurpleOverride),
    accentGreenOverride: getValue(rows, 'accentGreenOverride', SETTINGS_DEFAULTS.accentGreenOverride),
    accentAmberOverride: getValue(rows, 'accentAmberOverride', SETTINGS_DEFAULTS.accentAmberOverride),
    noteTagColors: parseNoteTagColors(String(getValue(rows, 'noteTagColors', JSON.stringify(SETTINGS_DEFAULTS.noteTagColors)))),
    recentHistoryLimit: getValue(rows, 'recentHistoryLimit', SETTINGS_DEFAULTS.recentHistoryLimit),
    focusNotificationsEnabled: getValue(rows, 'focusNotificationsEnabled', SETTINGS_DEFAULTS.focusNotificationsEnabled),
    cardOpacity: getValue(rows, 'cardOpacity', SETTINGS_DEFAULTS.cardOpacity),
    backdropBlur: getValue(rows, 'backdropBlur', SETTINGS_DEFAULTS.backdropBlur),
    tactile_feedback: getValue(rows, 'tactile_feedback', SETTINGS_DEFAULTS.tactile_feedback),
    developer_font: getValue(rows, 'developer_font', SETTINGS_DEFAULTS.developer_font),
    enforce_lockout: getValue(rows, 'enforce_lockout', SETTINGS_DEFAULTS.enforce_lockout),
    initialEasinessFactor: getValue(rows, 'initialEasinessFactor', SETTINGS_DEFAULTS.initialEasinessFactor),
    autoArchiveAncientTasks: getValue(rows, 'autoArchiveAncientTasks', SETTINGS_DEFAULTS.autoArchiveAncientTasks),
    autoArchiveAfterDays: getValue(rows, 'autoArchiveAfterDays', SETTINGS_DEFAULTS.autoArchiveAfterDays),
    lockoutMode: getValue(rows, 'lockoutMode', SETTINGS_DEFAULTS.lockoutMode),
    lockoutAllowedTabs: String(getValue(rows, 'lockoutAllowedTabs', SETTINGS_DEFAULTS.lockoutAllowedTabs)),
    lockoutStudyOnly: getValue(rows, 'lockoutStudyOnly', SETTINGS_DEFAULTS.lockoutStudyOnly),
    studyReminderEnabled: getValue(rows, 'studyReminderEnabled', SETTINGS_DEFAULTS.studyReminderEnabled),
    studyReminderTime: String(getValue(rows, 'studyReminderTime', SETTINGS_DEFAULTS.studyReminderTime)),
    studyReminderOnlyBelowGoal: getValue(rows, 'studyReminderOnlyBelowGoal', SETTINGS_DEFAULTS.studyReminderOnlyBelowGoal),
    schedulingAlgorithm: getValue(rows, 'schedulingAlgorithm', SETTINGS_DEFAULTS.schedulingAlgorithm),
    locale: String(getValue(rows, 'locale', SETTINGS_DEFAULTS.locale)),
    desktopMinimizeOnCloseEnabled: getValue(rows, 'desktopMinimizeOnCloseEnabled', SETTINGS_DEFAULTS.desktopMinimizeOnCloseEnabled),
    desktopGlobalTimerShortcut: String(getValue(rows, 'desktopGlobalTimerShortcut', SETTINGS_DEFAULTS.desktopGlobalTimerShortcut)),
    syncFolderPath: String(getValue(rows, 'syncFolderPath', SETTINGS_DEFAULTS.syncFolderPath)),
    ambientSoundEnabled: getValue(rows, 'ambientSoundEnabled', SETTINGS_DEFAULTS.ambientSoundEnabled),
    ambientSoundPreset: getValue(rows, 'ambientSoundPreset', SETTINGS_DEFAULTS.ambientSoundPreset),
    ambientVolume: getValue(rows, 'ambientVolume', SETTINGS_DEFAULTS.ambientVolume),
    autoExportEnabled: getValue(rows, 'autoExportEnabled', SETTINGS_DEFAULTS.autoExportEnabled),
    autoExportIntervalDays: getValue(rows, 'autoExportIntervalDays', SETTINGS_DEFAULTS.autoExportIntervalDays),
    desktopAutostartEnabled: getValue(rows, 'desktopAutostartEnabled', SETTINGS_DEFAULTS.desktopAutostartEnabled),
    desktopGlobalShortcutsEnabled: getValue(rows, 'desktopGlobalShortcutsEnabled', SETTINGS_DEFAULTS.desktopGlobalShortcutsEnabled),
    desktopNativeNotificationsEnabled: getValue(rows, 'desktopNativeNotificationsEnabled', SETTINGS_DEFAULTS.desktopNativeNotificationsEnabled),
    desktopBackupFolderPath: String(getValue(rows, 'desktopBackupFolderPath', SETTINGS_DEFAULTS.desktopBackupFolderPath)),
    historyRetentionDays: getValue(rows, 'historyRetentionDays', SETTINGS_DEFAULTS.historyRetentionDays),
    flashcardsEnabled: getValue(rows, 'flashcardsEnabled', SETTINGS_DEFAULTS.flashcardsEnabled),
  } as ParsedSettings
}

export type { SettingsValue }
