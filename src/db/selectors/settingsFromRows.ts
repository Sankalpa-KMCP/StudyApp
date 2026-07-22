import type { SettingsKey, SettingsRow, SettingsValue } from '../types'
import {
  DEFAULT_NOTE_TAG_COLORS,
  SETTINGS_DEFAULTS,
  type ParsedSettings,
} from '../../lib/settings/settingsDefaults'
import { parseNoteTagColorsArray } from '../../lib/settings/noteTagColors'

export { DEFAULT_NOTE_TAG_COLORS, SETTINGS_DEFAULTS, type ParsedSettings }

function parseNoteTagColors(raw: string): string[] {
  try {
    const colors = parseNoteTagColorsArray(JSON.parse(raw))
    return colors ?? [...DEFAULT_NOTE_TAG_COLORS]
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
    reduceVisualEffects: getValue(rows, 'reduceVisualEffects', SETTINGS_DEFAULTS.reduceVisualEffects),
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
    syncFolderPath: String(getValue(rows, 'syncFolderPath', SETTINGS_DEFAULTS.syncFolderPath) || getValue(rows, 'desktopBackupFolderPath', '')),
    syncEnabled: getValue(rows, 'syncEnabled', SETTINGS_DEFAULTS.syncEnabled),
    lastSyncAt: String(getValue(rows, 'lastSyncAt', SETTINGS_DEFAULTS.lastSyncAt)),
    lastSyncChecksum: String(getValue(rows, 'lastSyncChecksum', SETTINGS_DEFAULTS.lastSyncChecksum)),
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
  } as ParsedSettings
}

export type { SettingsValue }
