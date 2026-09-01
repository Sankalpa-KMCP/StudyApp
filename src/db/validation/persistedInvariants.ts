import type { ActiveFocusSession, ActiveFocusSessionStatus } from '../types'

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

/** Persisted instant: strict canonical 3-millisecond UTC ISO-8601 string matching a real calendar timestamp. */
export function isPersistedIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return false
  return new Date(parsed).toISOString() === value
}

/** Non-empty, non-whitespace string required for user-facing names and titles. */
export function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export const ACTIVE_FOCUS_SESSION_KEY = 'activeFocusSession'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isStatus(value: unknown): value is ActiveFocusSessionStatus {
  return value === 'running' || value === 'paused'
}

/**
 * Runtime type guard for durable unfinished focus sessions.
 * Rejects invalid IDs, timestamps, durations, pause combinations, and statuses.
 */
export function isActiveFocusSession(value: unknown): value is ActiveFocusSession {
  if (!isRecord(value)) return false
  if (!isNonEmptyString(value.id)) return false
  if (typeof value.subjectId !== 'string') return false
  if (!isPersistedIsoTimestamp(value.startedAt)) return false
  if (typeof value.plannedMinutes !== 'number' || !Number.isFinite(value.plannedMinutes) || value.plannedMinutes < 0) {
    return false
  }
  if (!isStatus(value.status)) return false
  if (typeof value.accumulatedPausedMs !== 'number' || !Number.isFinite(value.accumulatedPausedMs) || value.accumulatedPausedMs < 0) {
    return false
  }
  if (
    value.checkpointElapsedMs !== undefined &&
    (typeof value.checkpointElapsedMs !== 'number' || !Number.isFinite(value.checkpointElapsedMs) || value.checkpointElapsedMs < 0)
  ) {
    return false
  }

  const startedAtMs = Date.parse(value.startedAt)

  if (value.status === 'running') {
    return value.pausedAt === null
  }

  if (!isPersistedIsoTimestamp(value.pausedAt)) return false
  const pausedAtMs = Date.parse(value.pausedAt)
  return pausedAtMs >= startedAtMs
}
