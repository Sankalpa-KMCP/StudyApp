import type { ActiveFocusSession, ActiveFocusSessionStatus } from './types'
import { studyDb } from './studyDb'

export const ACTIVE_FOCUS_SESSION_KEY = 'activeFocusSession'

/** A session is unusually old at or beyond 12 hours since start (pause-independent). */
export const ACTIVE_FOCUS_SESSION_STALE_AFTER_MS = 12 * 60 * 60 * 1000

export type CreateActiveFocusSessionResult =
  | { ok: true; session: ActiveFocusSession }
  | { ok: false; reason: 'conflict'; existing: ActiveFocusSession }
  | { ok: false; reason: 'invalid' }

export type UpdateActiveFocusSessionResult =
  | { ok: true; session: ActiveFocusSession }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'conflict'; existing: ActiveFocusSession }
  | { ok: false; reason: 'invalid' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value))
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
  if (!isIsoTimestamp(value.startedAt)) return false
  if (typeof value.plannedMinutes !== 'number' || !Number.isFinite(value.plannedMinutes) || value.plannedMinutes < 0) {
    return false
  }
  if (!isStatus(value.status)) return false
  if (typeof value.accumulatedPausedMs !== 'number' || !Number.isFinite(value.accumulatedPausedMs) || value.accumulatedPausedMs < 0) {
    return false
  }

  const startedAtMs = Date.parse(value.startedAt)

  if (value.status === 'running') {
    return value.pausedAt === null
  }

  if (!isIsoTimestamp(value.pausedAt)) return false
  const pausedAtMs = Date.parse(value.pausedAt)
  return pausedAtMs >= startedAtMs
}

/** Elapsed active focus time in milliseconds (never negative). */
export function getActiveFocusElapsedMs(session: ActiveFocusSession, nowMs = Date.now()): number {
  const startedAtMs = Date.parse(session.startedAt)
  const frozenEndMs = session.status === 'paused' && session.pausedAt
    ? Date.parse(session.pausedAt)
    : nowMs
  return Math.max(0, frozenEndMs - startedAtMs - session.accumulatedPausedMs)
}

/** True when `nowMs` is at or beyond 12 hours after session start. */
export function isActiveFocusSessionStale(session: ActiveFocusSession, nowMs = Date.now()): boolean {
  const startedAtMs = Date.parse(session.startedAt)
  return nowMs - startedAtMs >= ACTIVE_FOCUS_SESSION_STALE_AFTER_MS
}

/**
 * Reads the singleton unfinished session.
 * Malformed values are deleted and treated as absent (never throws).
 */
export async function getActiveFocusSession(): Promise<ActiveFocusSession | null> {
  try {
    const record = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
    if (!record) return null
    if (isActiveFocusSession(record.value)) return record.value
    await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
    return null
  } catch {
    return null
  }
}

/**
 * Atomically creates the singleton unfinished session.
 * Does not overwrite an existing valid session (observable conflict).
 */
export async function createActiveFocusSession(session: ActiveFocusSession): Promise<CreateActiveFocusSessionResult> {
  if (!isActiveFocusSession(session)) return { ok: false, reason: 'invalid' }

  return studyDb.transaction('rw', studyDb.settings, async () => {
    const existingRecord = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
    if (existingRecord && isActiveFocusSession(existingRecord.value)) {
      return { ok: false, reason: 'conflict', existing: existingRecord.value }
    }

    if (existingRecord) {
      await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
    }

    await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: session })
    return { ok: true, session }
  })
}

/**
 * Replaces the singleton unfinished session when the id matches the existing record.
 * Affects only the reserved settings key.
 */
export async function updateActiveFocusSession(session: ActiveFocusSession): Promise<UpdateActiveFocusSessionResult> {
  if (!isActiveFocusSession(session)) return { ok: false, reason: 'invalid' }

  return studyDb.transaction('rw', studyDb.settings, async () => {
    const existingRecord = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
    if (!existingRecord) return { ok: false, reason: 'missing' }

    if (!isActiveFocusSession(existingRecord.value)) {
      await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
      return { ok: false, reason: 'missing' }
    }

    if (existingRecord.value.id !== session.id) {
      return { ok: false, reason: 'conflict', existing: existingRecord.value }
    }

    await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: session })
    return { ok: true, session }
  })
}

/** Clears only the reserved unfinished-session settings record. */
export async function clearActiveFocusSession(): Promise<void> {
  await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
}
