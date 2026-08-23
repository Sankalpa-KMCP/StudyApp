import { clamp } from '../appUtils'

/**
 * UI/editor usability ranges for form controls and draft normalization.
 * These are not persisted-record invariants — import continues to accept
 * Task minutes `>= 0` (including 0 and values above the editor maximum).
 */

/** Task editor minutes floor (inclusive). */
export const TASK_EDITOR_MINUTES_MIN = 5

/** Task editor minutes ceiling (inclusive). */
export const TASK_EDITOR_MINUTES_MAX = 720

/** Clamp a Task draft minutes value to the editor usability range. */
export function clampTaskEditorMinutes(value: number): number {
  return clamp(value, TASK_EDITOR_MINUTES_MIN, TASK_EDITOR_MINUTES_MAX)
}

/** Subject editor target-hours floor (inclusive). */
export const SUBJECT_EDITOR_TARGET_HOURS_MIN = 1

/** Subject editor target-hours ceiling (inclusive). */
export const SUBJECT_EDITOR_TARGET_HOURS_MAX = 100

/** Subject editor progress % floor (inclusive). */
export const SUBJECT_EDITOR_PROGRESS_MIN = 0

/** Subject editor progress % ceiling (inclusive). */
export const SUBJECT_EDITOR_PROGRESS_MAX = 100

/** Clamp a Subject draft target-hours value to the editor usability range. */
export function clampSubjectEditorTargetHours(value: number): number {
  return clamp(value, SUBJECT_EDITOR_TARGET_HOURS_MIN, SUBJECT_EDITOR_TARGET_HOURS_MAX)
}

/** Clamp a Subject draft progress % value to the editor usability range. */
export function clampSubjectEditorProgress(value: number): number {
  return clamp(value, SUBJECT_EDITOR_PROGRESS_MIN, SUBJECT_EDITOR_PROGRESS_MAX)
}

/** Calendar event editor duration floor (inclusive). Save also rejects below this. */
export const CALENDAR_EDITOR_DURATION_MIN = 15

/**
 * Calendar event editor duration ceiling (inclusive) for NumberInput clamping.
 * Save does not re-check this ceiling — import may accept longer events.
 */
export const CALENDAR_EDITOR_DURATION_MAX = 480

/** Clamp a Calendar draft duration value to the editor NumberInput range. */
export function clampCalendarEditorDuration(value: number): number {
  return clamp(value, CALENDAR_EDITOR_DURATION_MIN, CALENDAR_EDITOR_DURATION_MAX)
}

/**
 * Progress manual-session editor minimum duration in minutes (inclusive).
 * Import only requires minutes > 0; future-ended sessions remain importable.
 */
export const STUDY_SESSION_EDITOR_DURATION_MIN = 1

/** Goal editor target floor (inclusive). Save rejects non-finite or ≤ 0 before clamping. */
export const GOAL_EDITOR_TARGET_MIN = 1

/**
 * Goal editor target ceiling (inclusive).
 * Import continues to accept targets above this (e.g. 10001); `dailyGoalMinutes` requires positive finite minutes.
 */
export const GOAL_EDITOR_TARGET_MAX = 10_000

/** Clamp a Goal draft target to the editor usability range after rounding. */
export function clampGoalEditorTarget(value: number): number {
  return clamp(Math.round(value), GOAL_EDITOR_TARGET_MIN, GOAL_EDITOR_TARGET_MAX)
}

/**
 * Clamp manual Goal progress to `[0, target]` after rounding.
 * Non-finite draft progress maps to 0 before clamping.
 */
export function clampGoalEditorManualProgress(value: number, target: number): number {
  return clamp(Math.round(Number.isFinite(value) ? value : 0), 0, target)
}
