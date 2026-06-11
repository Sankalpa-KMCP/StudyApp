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
  } as ParsedSettings
}

export type { SettingsValue }
