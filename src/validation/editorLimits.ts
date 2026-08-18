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
