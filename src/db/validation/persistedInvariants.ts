/**
 * Message-neutral persisted-record invariants used by backup import semantics.
 * Editor-only ranges (task 5–720, goal 1–10000, event 15–480, future end, etc.)
 * must not be introduced here.
 */

/** Subject manual progress percentage: inclusive 0–100. */
export function isPersistedSubjectProgress(progress: number): boolean {
  return progress >= 0 && progress <= 100
}

/** Subject target hours: strictly greater than zero (no import upper maximum). */
export function isPersistedSubjectTargetHours(targetHours: number): boolean {
  return targetHours > 0
}

/** Task minutes: zero and above (editor 5–720 is not applied). */
export function isPersistedTaskMinutes(minutes: number): boolean {
  return minutes >= 0
}

/** Finalized study-session minutes: strictly greater than zero. */
export function isPersistedStudySessionMinutes(minutes: number): boolean {
  return minutes > 0
}

/**
 * Start/end ISO ordering for events and study sessions.
 * Equal timestamps are accepted. Matches prior import behaviour:
 * rejects only when `Date.parse(end) < Date.parse(start)` (NaN comparisons do not reject).
 */
export function isPersistedTimestampOrder(startIso: string, endIso: string): boolean {
  return !(Date.parse(endIso) < Date.parse(startIso))
}

/** Goal target: strictly greater than zero (no import upper maximum). */
export function isPersistedGoalTarget(target: number): boolean {
  return target > 0
}

/** Goal progress: non-negative; may exceed target. */
export function isPersistedGoalProgress(progress: number): boolean {
  return progress >= 0
}

/**
 * Optional flashcard schedule counters: absent is valid; when present must be non-negative.
 */
export function isPersistedOptionalNonNegativeCounter(value: number | undefined): boolean {
  return value === undefined || value >= 0
}

/**
 * Subject reference for imported rows and valid active-focus payloads.
 * Empty string is General; non-empty IDs must exist in the imported subject id set.
 */
export function isPersistedSubjectReference(
  subjectId: string,
  subjectIds: ReadonlySet<string>,
): boolean {
  return subjectId === '' || subjectIds.has(subjectId)
}
