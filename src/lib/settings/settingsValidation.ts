import type { SettingsKey, SettingsValue } from '../../db/types'
import { MAX_STUDY_BLOCK_MINUTES } from '../shared/timerConstants'

const UI_FONT_OPTIONS = ['Inter', 'Outfit', 'System'] as const
const UI_DENSITY_OPTIONS = ['comfortable', 'compact'] as const
const AMBIENT_PRESET_OPTIONS = ['rain', 'white-noise', 'cafe', 'brown-noise'] as const
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

interface NumericRule {
  min: number
  max: number
  step: number
}

const NUMERIC_RULES: Partial<Record<SettingsKey, NumericRule>> = {
  dailyGoalMinutes: { min: 30, max: 960, step: 30 },
  studyBlockDurationMinutes: { min: 5, max: MAX_STUDY_BLOCK_MINUTES, step: 5 },
  shortBreakDurationMinutes: { min: 1, max: 30, step: 1 },
  longBreakDurationMinutes: { min: 5, max: 60, step: 5 },
  targetSessionsPerCycle: { min: 1, max: 10, step: 1 },
  recentHistoryLimit: { min: 50, max: 500, step: 25 },
  historyRetentionDays: { min: 0, max: 365, step: 30 },
  autoArchiveAfterDays: { min: 30, max: 365, step: 30 },
  cardOpacity: { min: 0.2, max: 0.9, step: 0.05 },
  backdropBlur: { min: 4, max: 24, step: 1 },
  backdropSaturate: { min: 100, max: 200, step: 5 },
  cardBorderOpacity: { min: 0.04, max: 0.16, step: 0.01 },
  initialEasinessFactor: { min: 1.3, max: 3.5, step: 0.1 },
  ambientVolume: { min: 0, max: 100, step: 5 },
  autoExportIntervalDays: { min: 1, max: 30, step: 1 },
}

function clampToStep(value: number, rule: NumericRule): number {
  const clamped = Math.min(rule.max, Math.max(rule.min, value))
  const steps = Math.round((clamped - rule.min) / rule.step)
  const snapped = rule.min + steps * rule.step
  const decimals = (rule.step.toString().split('.')[1] ?? '').length
  return decimals > 0 ? Number(snapped.toFixed(decimals)) : snapped
}

function parseNoteTagColorsValue(raw: SettingsValue): string[] | null {
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const colors = parsed.filter((c): c is string => typeof c === 'string' && HEX_COLOR.test(c))
    return colors.length > 0 ? colors.slice(0, 8) : null
  } catch {
    return null
  }
}

export type ValidateResult =
  | { ok: true; value: SettingsValue }
  | { ok: false; reason: string }

export function validateSetting(key: SettingsKey, value: SettingsValue): ValidateResult {
  if (value === null) {
    if (
      key === 'accentBlueOverride' ||
      key === 'accentPurpleOverride' ||
      key === 'accentGreenOverride' ||
      key === 'accentAmberOverride'
    ) {
      return { ok: true, value: null }
    }
    return { ok: false, reason: `${key} cannot be null` }
  }

  const numericRule = NUMERIC_RULES[key]
  if (numericRule) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return { ok: false, reason: `${key} must be a number` }
    }
    return { ok: true, value: clampToStep(value, numericRule) }
  }

  if (
    key === 'soundEnabled' ||
    key === 'focusNotificationsEnabled' ||
    key === 'tactile_feedback' ||
    key === 'enforce_lockout' ||
    key === 'autoArchiveAncientTasks' ||
    key === 'ambientSoundEnabled' ||
    key === 'flashcardsEnabled' ||
    key === 'autoExportEnabled' ||
    key === 'desktopAutostartEnabled' ||
    key === 'desktopGlobalShortcutsEnabled' ||
    key === 'desktopNativeNotificationsEnabled' ||
    key === 'lockoutStudyOnly' ||
    key === 'studyReminderEnabled' ||
    key === 'studyReminderOnlyBelowGoal' ||
    key === 'desktopMinimizeOnCloseEnabled'
  ) {
    if (typeof value !== 'boolean') return { ok: false, reason: `${key} must be a boolean` }
    return { ok: true, value }
  }

  if (key === 'lockoutMode') {
    if (value !== 'strict' && value !== 'soft') return { ok: false, reason: 'lockoutMode must be strict or soft' }
    return { ok: true, value }
  }

  if (key === 'schedulingAlgorithm') {
    if (value !== 'sm2' && value !== 'fsrs') return { ok: false, reason: 'schedulingAlgorithm must be sm2 or fsrs' }
    return { ok: true, value }
  }

  if (key === 'lockoutAllowedTabs' || key === 'studyReminderTime' || key === 'locale' || key === 'desktopGlobalTimerShortcut' || key === 'syncFolderPath') {
    if (typeof value !== 'string') return { ok: false, reason: `${key} must be a string` }
    return { ok: true, value }
  }

  if (key === 'uiDensity') {
    if (typeof value !== 'string' || !UI_DENSITY_OPTIONS.includes(value as (typeof UI_DENSITY_OPTIONS)[number])) {
      return { ok: false, reason: 'uiDensity must be comfortable or compact' }
    }
    return { ok: true, value }
  }

  if (key === 'ambientSoundPreset') {
    if (typeof value !== 'string' || !AMBIENT_PRESET_OPTIONS.includes(value as (typeof AMBIENT_PRESET_OPTIONS)[number])) {
      return { ok: false, reason: 'ambientSoundPreset must be rain, white-noise, cafe, or brown-noise' }
    }
    return { ok: true, value }
  }

  if (key === 'ui_font') {
    if (typeof value !== 'string' || !UI_FONT_OPTIONS.includes(value as (typeof UI_FONT_OPTIONS)[number])) {
      return { ok: false, reason: 'ui_font must be Inter, Outfit, or System' }
    }
    return { ok: true, value }
  }

  if (
    key === 'accentBlueOverride' ||
    key === 'accentPurpleOverride' ||
    key === 'accentGreenOverride' ||
    key === 'accentAmberOverride'
  ) {
    if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
      return { ok: false, reason: `${key} must be a hex color` }
    }
    return { ok: true, value }
  }

  if (key === 'noteTagColors') {
    const colors = parseNoteTagColorsValue(value)
    if (!colors) return { ok: false, reason: 'noteTagColors must be a JSON array of hex colors' }
    return { ok: true, value: JSON.stringify(colors) }
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return { ok: true, value }
  }

  return { ok: false, reason: `Invalid value for ${key}` }
}

export function clampSetting(key: SettingsKey, value: SettingsValue): SettingsValue {
  const result = validateSetting(key, value)
  if (result.ok) return result.value
  const numericRule = NUMERIC_RULES[key]
  if (numericRule && typeof value === 'number' && !Number.isNaN(value)) {
    return clampToStep(value, numericRule)
  }
  return value
}
