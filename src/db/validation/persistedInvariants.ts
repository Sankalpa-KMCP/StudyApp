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
 * Subject reference for imported rows and valid active-focus payloads.
 * Empty string is General; non-empty IDs must exist in the imported subject id set.
 */
export function isPersistedSubjectReference(
  subjectId: string,
  subjectIds: ReadonlySet<string>,
): boolean {
  return subjectId === '' || subjectIds.has(subjectId)
}

/** Daily goal focus minutes setting: positive finite number (no import upper maximum). */
export function isPersistedDailyGoalMinutes(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** Local calendar date key: strict YYYY-MM-DD matching a real Gregorian calendar date. */
export function isPersistedLocalDateKey(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = Date.parse(value + 'T00:00:00.000Z')
  if (Number.isNaN(parsed)) return false
  return new Date(parsed).toISOString().startsWith(value)
}

/** Task due date: optional empty string or valid local calendar date key. */
export function isPersistedDueDate(value: unknown): value is string {
  return value === '' || isPersistedLocalDateKey(value)
}

/** Persisted instant: strict UTC ISO-8601 string matching a real calendar timestamp. */
export function isPersistedIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) return false
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return false
  const canonical = new Date(parsed).toISOString()
  return canonical === value || canonical.replace(/\.000Z$/, 'Z') === value
}
