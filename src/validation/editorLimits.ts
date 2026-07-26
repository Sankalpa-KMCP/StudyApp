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
