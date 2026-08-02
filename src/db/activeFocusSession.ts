import type { ActiveFocusSession, ActiveFocusSessionStatus, StudySession } from './types'
import { nowIso, studyDb } from './studyDb'

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

export type FinalizeActiveFocusSessionResult =
  | { ok: true; history: StudySession }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'conflict'; existing: ActiveFocusSession }

export type TransitionActiveFocusSessionResult =
  | { ok: true; session: ActiveFocusSession }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'conflict'; existing: ActiveFocusSession }
  | { ok: false; reason: 'invalid_state'; existing: ActiveFocusSession }

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

/**
 * True when a durable unfinished session is eligible for timed auto-completion.
 * Uses active elapsed time only (via {@link getActiveFocusElapsedMs}); does not read IndexedDB.
 */
export function shouldAutoCompleteFocusSession(session: ActiveFocusSession, nowMs = Date.now()): boolean {
  if (session.status !== 'running' || session.plannedMinutes <= 0) return false
  return getActiveFocusElapsedMs(session, nowMs) >= session.plannedMinutes * 60_000
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

export type DiscardActiveFocusSessionResult =
  | { ok: true }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'conflict'; existing: ActiveFocusSession }

/** Clears only the reserved unfinished-session settings record. */
export async function clearActiveFocusSession(): Promise<void> {
  await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
}

/**
 * Atomically removes the unfinished singleton when the persisted id matches.
 * Never writes study-history rows.
 */
export async function discardActiveFocusSession(sessionId: string): Promise<DiscardActiveFocusSessionResult> {
  if (!sessionId) return { ok: false, reason: 'missing' }

  return studyDb.transaction('rw', studyDb.settings, async () => {
    const existingRecord = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
    if (!existingRecord || !isActiveFocusSession(existingRecord.value)) {
      if (existingRecord) await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
      return { ok: false, reason: 'missing' }
    }

    if (existingRecord.value.id !== sessionId) {
      return { ok: false, reason: 'conflict', existing: existingRecord.value }
    }

    await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
    return { ok: true }
  })
}

/**
 * Atomically pauses a running unfinished session.
 * Verifies matching id and `running` status before writing.
 */
export async function pauseActiveFocusSession(
  sessionId: string,
  pausedAt = nowIso(),
): Promise<TransitionActiveFocusSessionResult> {
  if (!sessionId || !isIsoTimestamp(pausedAt)) return { ok: false, reason: 'missing' }

  return studyDb.transaction('rw', studyDb.settings, async () => {
    const existingRecord = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
    if (!existingRecord || !isActiveFocusSession(existingRecord.value)) {
      if (existingRecord) await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
      return { ok: false, reason: 'missing' }
    }

    const existing = existingRecord.value
    if (existing.id !== sessionId) {
      return { ok: false, reason: 'conflict', existing }
    }
    if (existing.status !== 'running') {
      return { ok: false, reason: 'invalid_state', existing }
    }

    const session: ActiveFocusSession = {
      ...existing,
      status: 'paused',
      pausedAt,
    }
    await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: session })
    return { ok: true, session }
  })
}

/**
 * Atomically resumes a paused unfinished session.
 * Adds the full pause interval to `accumulatedPausedMs` and clears `pausedAt`.
 */
export async function resumeActiveFocusSession(
  sessionId: string,
  resumedAtMs = Date.now(),
): Promise<TransitionActiveFocusSessionResult> {
  if (!sessionId) return { ok: false, reason: 'missing' }

  return studyDb.transaction('rw', studyDb.settings, async () => {
    const existingRecord = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
    if (!existingRecord || !isActiveFocusSession(existingRecord.value)) {
      if (existingRecord) await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
      return { ok: false, reason: 'missing' }
    }

    const existing = existingRecord.value
    if (existing.id !== sessionId) {
      return { ok: false, reason: 'conflict', existing }
    }
    if (existing.status !== 'paused' || !existing.pausedAt) {
      return { ok: false, reason: 'invalid_state', existing }
    }

    const pauseIntervalMs = Math.max(0, resumedAtMs - Date.parse(existing.pausedAt))
    const session: ActiveFocusSession = {
      ...existing,
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: existing.accumulatedPausedMs + pauseIntervalMs,
    }
    await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: session })
    return { ok: true, session }
  })
}

/**
 * Atomically writes one study-history row (id = focus session id) and clears the
 * unfinished singleton when the persisted active session id matches.
 * Safe to call repeatedly for the same session id.
 */
export async function finalizeActiveFocusSession(
  sessionId: string,
  history: Omit<StudySession, 'id'>,
): Promise<FinalizeActiveFocusSessionResult> {
  if (!sessionId) return { ok: false, reason: 'missing' }

  return studyDb.transaction('rw', studyDb.settings, studyDb.studySessions, async () => {
    const existingHistory = await studyDb.studySessions.get(sessionId)
    const activeRecord = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
    const activeSession = activeRecord && isActiveFocusSession(activeRecord.value) ? activeRecord.value : null

    if (activeSession && activeSession.id !== sessionId) {
      return { ok: false, reason: 'conflict', existing: activeSession }
    }

    if (activeSession && activeSession.id === sessionId) {
      const historyRow: StudySession = existingHistory ?? { id: sessionId, ...history }
      if (!existingHistory) {
        await studyDb.studySessions.add(historyRow)
      }
      await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
      return { ok: true, history: historyRow }
    }

    // Unfinished record already cleared — treat matching history as successful finalize.
    if (existingHistory) {
      return { ok: true, history: existingHistory }
    }

    return { ok: false, reason: 'missing' }
  })
}
