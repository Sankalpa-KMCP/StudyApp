import type { SettingsKey, SettingsRow, SettingsValue } from '../types'

export interface ParsedSettings {
  dailyGoalMinutes: number
  soundEnabled: boolean
  targetSessionsPerCycle: number
  longBreakDurationMinutes: number
  shortBreakDurationMinutes: number
  studyBlockDurationMinutes: number
  theme: string
  cardOpacity: number
  backdropBlur: number
  tactile_feedback: boolean
  developer_font: string
  enforce_lockout: boolean
  initialEasinessFactor: number
  autoArchiveAncientTasks: boolean
}

const DEFAULTS: ParsedSettings = {
  dailyGoalMinutes: 480,
  soundEnabled: true,
  targetSessionsPerCycle: 4,
  longBreakDurationMinutes: 15,
  shortBreakDurationMinutes: 5,
  studyBlockDurationMinutes: 25,
  theme: 'midnight-slate',
  cardOpacity: 0.7,
  backdropBlur: 8,
  tactile_feedback: false,
  developer_font: 'JetBrains Mono',
  enforce_lockout: false,
  initialEasinessFactor: 2.5,
  autoArchiveAncientTasks: false,
}

function getValue<K extends keyof ParsedSettings>(
  rows: SettingsRow[] | undefined,
  key: SettingsKey,
  fallback: ParsedSettings[K],
): ParsedSettings[K] {
  const row = rows?.find(r => r.key === key)
  return (row?.value as ParsedSettings[K]) ?? fallback
}

export function settingsFromRows(rows: SettingsRow[] | undefined): ParsedSettings {
  return {
    dailyGoalMinutes: getValue(rows, 'dailyGoalMinutes', DEFAULTS.dailyGoalMinutes),
    soundEnabled: getValue(rows, 'soundEnabled', DEFAULTS.soundEnabled),
    targetSessionsPerCycle: getValue(rows, 'targetSessionsPerCycle', DEFAULTS.targetSessionsPerCycle),
    longBreakDurationMinutes: getValue(rows, 'longBreakDurationMinutes', DEFAULTS.longBreakDurationMinutes),
    shortBreakDurationMinutes: getValue(rows, 'shortBreakDurationMinutes', DEFAULTS.shortBreakDurationMinutes),
    studyBlockDurationMinutes: getValue(rows, 'studyBlockDurationMinutes', DEFAULTS.studyBlockDurationMinutes),
    theme: getValue(rows, 'theme', DEFAULTS.theme),
    cardOpacity: getValue(rows, 'cardOpacity', DEFAULTS.cardOpacity),
    backdropBlur: getValue(rows, 'backdropBlur', DEFAULTS.backdropBlur),
    tactile_feedback: getValue(rows, 'tactile_feedback', DEFAULTS.tactile_feedback),
    developer_font: getValue(rows, 'developer_font', DEFAULTS.developer_font),
    enforce_lockout: getValue(rows, 'enforce_lockout', DEFAULTS.enforce_lockout),
    initialEasinessFactor: getValue(rows, 'initialEasinessFactor', DEFAULTS.initialEasinessFactor),
    autoArchiveAncientTasks: getValue(rows, 'autoArchiveAncientTasks', DEFAULTS.autoArchiveAncientTasks),
  }
}

export type { SettingsValue }
