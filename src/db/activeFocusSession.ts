import type { ActiveFocusSession, ActiveFocusSessionStatus, StudySession } from './types'
import {
  type DatabaseMutationContext,
  withGuardedMutation,
} from './databaseMutationGuard'
import { withSharedDatabaseLock } from './crossTabLock'
import { getDatabaseGeneration } from './databaseGeneration'
import { createId, nowIso, studyDb } from './studyDb'
import { assertSubjectExists, isSubjectNotFoundError } from './subjectValidation'
import {
  ACTIVE_FOCUS_SESSION_KEY,
  isActiveFocusSession,
  isPersistedIsoTimestamp,
} from './validation/persistedInvariants'
import { assertStudySessionWriteFields } from './validation/domainValidation'

export {
  ACTIVE_FOCUS_SESSION_KEY,
  isActiveFocusSession,
}

/** A session is unusually old at or beyond 12 hours since start (pause-independent). */
export const ACTIVE_FOCUS_SESSION_STALE_AFTER_MS = 12 * 60 * 60 * 1000

export type CreateActiveFocusSessionResult =
  | { ok: true; session: ActiveFocusSession; generation: number }
  | { ok: false; reason: 'conflict'; existing: ActiveFocusSession }
  | { ok: false; reason: 'id_collision' }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'missing_subject' }

export type UpdateActiveFocusSessionResult =
  | { ok: true; session: ActiveFocusSession }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'conflict'; existing: ActiveFocusSession }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'missing_subject' }

export type FinalizeActiveFocusSessionResult =
  | { ok: true; history: StudySession }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'conflict'; existing: ActiveFocusSession }
  | { ok: false; reason: 'missing_subject' }
  | { ok: false; reason: 'id_rekeyed'; session: ActiveFocusSession }

export type TransitionActiveFocusSessionResult =
  | { ok: true; session: ActiveFocusSession }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'conflict'; existing: ActiveFocusSession }
  | { ok: false; reason: 'invalid_state'; existing: ActiveFocusSession }

export type CheckpointActiveFocusSessionResult =
  | { ok: true; session: ActiveFocusSession }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'conflict'; existing: ActiveFocusSession }
  | { ok: false; reason: 'invalid_state'; existing: ActiveFocusSession }
  | { ok: false; reason: 'invalid' }

export type PauseActiveFocusSessionOptions = {
  pausedAt?: string
  logicalElapsedMs?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isIsoTimestamp(value: unknown): value is string {
  return isPersistedIsoTimestamp(value)
}

function isStatus(value: unknown): value is ActiveFocusSessionStatus {
  return value === 'running' || value === 'paused'
}

/**
 * Normalizes an arbitrary value from settings into a structurally valid ActiveFocusSession,
 * safely recovering from known legacy rollback anomalies (e.g. pausedAt < startedAt).
 * Genuinely corrupt or unrecoverable records return null.
 */
export function normalizeActiveFocusSession(value: unknown): ActiveFocusSession | null {
  if (!isRecord(value)) return null
  if (!isNonEmptyString(value.id)) return null
  if (typeof value.subjectId !== 'string') return null
  if (!isIsoTimestamp(value.startedAt)) return null
  if (typeof value.plannedMinutes !== 'number' || !Number.isFinite(value.plannedMinutes) || value.plannedMinutes < 0) {
    return null
  }
  if (!isStatus(value.status)) return null
  if (typeof value.accumulatedPausedMs !== 'number' || !Number.isFinite(value.accumulatedPausedMs) || value.accumulatedPausedMs < 0) {
    return null
  }

  const checkpointElapsedMs = (
    typeof value.checkpointElapsedMs === 'number' &&
    Number.isFinite(value.checkpointElapsedMs) &&
    value.checkpointElapsedMs >= 0
  )
    ? Math.floor(value.checkpointElapsedMs)
    : undefined

  const startedAtMs = Date.parse(value.startedAt)

  if (value.status === 'running') {
    if (value.pausedAt !== null) return null
    return {
      id: value.id,
      subjectId: value.subjectId,
      startedAt: value.startedAt,
      plannedMinutes: value.plannedMinutes,
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: value.accumulatedPausedMs,
      ...(checkpointElapsedMs !== undefined ? { checkpointElapsedMs } : {}),
    }
  }

  // status === 'paused'
  if (!isIsoTimestamp(value.pausedAt)) return null
  const pausedAtMs = Date.parse(value.pausedAt)

  // Heal known rollback anomaly: pausedAt < startedAt -> clamp pausedAt = startedAt
  const safePausedAt = pausedAtMs < startedAtMs ? value.startedAt : value.pausedAt

  return {
    id: value.id,
    subjectId: value.subjectId,
    startedAt: value.startedAt,
    plannedMinutes: value.plannedMinutes,
    status: 'paused',
    pausedAt: safePausedAt,
    accumulatedPausedMs: value.accumulatedPausedMs,
    ...(checkpointElapsedMs !== undefined ? { checkpointElapsedMs } : {}),
  }
}

/** Elapsed active focus time in milliseconds (never negative). */
export function getActiveFocusElapsedMs(session: ActiveFocusSession, nowMs = Date.now()): number {
  if (
    typeof session.checkpointElapsedMs === 'number' &&
    Number.isFinite(session.checkpointElapsedMs) &&
    session.checkpointElapsedMs >= 0
  ) {
    return session.checkpointElapsedMs
  }

  const startedAtMs = Date.parse(session.startedAt)
  if (session.status === 'paused') {
    const frozenEndMs = session.pausedAt ? Date.parse(session.pausedAt) : startedAtMs
    return Math.max(0, frozenEndMs - startedAtMs - session.accumulatedPausedMs)
  }

  // running (legacy uncheckpointed fallback only)
  return Math.max(0, nowMs - startedAtMs - session.accumulatedPausedMs)
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
 * Malformed values are treated as absent without mutating the database.
 * Recoverable anomaly records (pausedAt < startedAt) are normalized in memory.
 * Throws on storage/database read failure.
 */
export async function getActiveFocusSession(): Promise<ActiveFocusSession | null> {
  const record = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
  if (!record) return null
  return normalizeActiveFocusSession(record.value)
}

/**
 * Reads the singleton unfinished session alongside the current database generation
 * under the shared database Web Lock.
 */
export async function getActiveFocusSessionWithGeneration(): Promise<{
  session: ActiveFocusSession | null
  generation: number
}> {
  return withSharedDatabaseLock(async () => {
    const generation = await getDatabaseGeneration(studyDb.settings)
    const record = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
    const session = record ? normalizeActiveFocusSession(record.value) : null
    return { session, generation }
  })
}

/**
 * Atomically creates the singleton unfinished session under shared Web Lock.
 * Does not overwrite an existing valid session (observable conflict).
 * Enforces transactional subject referential integrity and generation guard.
 */
export async function createActiveFocusSession(
  session: ActiveFocusSession,
  context: DatabaseMutationContext,
): Promise<CreateActiveFocusSessionResult> {
  if (!isActiveFocusSession(session)) return { ok: false, reason: 'invalid' }

  return withGuardedMutation(context, () =>
    studyDb.transaction('rw', studyDb.subjects, studyDb.settings, studyDb.studySessions, async () => {
      try {
        await assertSubjectExists(session.subjectId)
      } catch (err) {
        if (isSubjectNotFoundError(err)) {
          return { ok: false, reason: 'missing_subject' }
        }
        throw err
      }

      const existingHistory = await studyDb.studySessions.get(session.id)
      if (existingHistory) {
        return { ok: false, reason: 'id_collision' }
      }

      const existingRecord = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
      const existing = existingRecord ? normalizeActiveFocusSession(existingRecord.value) : null
      if (existing) {
        return { ok: false, reason: 'conflict', existing }
      }

      if (existingRecord) {
        await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
      }

      await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: session })
      return { ok: true, session, generation: context.expectedGeneration }
    }),
  )
}

/**
 * Persists an updated durable progress checkpoint for a running session under generation guard.
 * Stale or lower elapsed writes are safe no-ops (monotonic CAS).
 */
export async function checkpointActiveFocusSession(
  sessionId: string,
  logicalElapsedMs: number,
  context: DatabaseMutationContext,
): Promise<CheckpointActiveFocusSessionResult> {
  if (
    !sessionId ||
    typeof logicalElapsedMs !== 'number' ||
    !Number.isFinite(logicalElapsedMs) ||
    logicalElapsedMs < 0
  ) {
    return { ok: false, reason: 'invalid' }
  }

  return withGuardedMutation(context, () =>
    studyDb.transaction('rw', studyDb.settings, async () => {
      const existingRecord = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
      if (!existingRecord) return { ok: false, reason: 'missing' }

      const existing = normalizeActiveFocusSession(existingRecord.value)
      if (!existing) {
        await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
        return { ok: false, reason: 'missing' }
      }

      if (existing.id !== sessionId) {
        return { ok: false, reason: 'conflict', existing }
      }

      if (existing.status !== 'running') {
        return { ok: false, reason: 'invalid_state', existing }
      }

      const validatedIncoming = Math.floor(logicalElapsedMs)
      const currentDurable = existing.checkpointElapsedMs ?? 0

      // Monotonic CAS: Stale or lower writes are a safe no-op
      if (validatedIncoming <= currentDurable) {
        return { ok: true, session: existing }
      }

      const updated: ActiveFocusSession = {
        ...existing,
        checkpointElapsedMs: validatedIncoming,
      }

      await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: updated })
      return { ok: true, session: updated }
    }),
  )
}

/**
 * Replaces the singleton unfinished session when the id matches the existing record
 * and the database generation matches context.
 * Affects only the reserved settings key.
 * Enforces transactional subject referential integrity.
 */
export async function updateActiveFocusSession(
  session: ActiveFocusSession,
  context: DatabaseMutationContext,
): Promise<UpdateActiveFocusSessionResult> {
  if (!isActiveFocusSession(session)) return { ok: false, reason: 'invalid' }

  return withGuardedMutation(context, () =>
    studyDb.transaction('rw', studyDb.subjects, studyDb.settings, async () => {
      const existingRecord = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
      if (!existingRecord) return { ok: false, reason: 'missing' }

      const existing = normalizeActiveFocusSession(existingRecord.value)
      if (!existing) {
        await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
        return { ok: false, reason: 'missing' }
      }

      if (existing.id !== session.id) {
        return { ok: false, reason: 'conflict', existing }
      }

      try {
        await assertSubjectExists(session.subjectId)
      } catch (err) {
        if (isSubjectNotFoundError(err)) {
          return { ok: false, reason: 'missing_subject' }
        }
        throw err
      }

      const sessionToPersist: ActiveFocusSession = {
        ...session,
        checkpointElapsedMs: session.checkpointElapsedMs ?? existing.checkpointElapsedMs,
      }

      await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: sessionToPersist })
      return { ok: true, session: sessionToPersist }
    }),
  )
}

export type DiscardActiveFocusSessionResult =
  | { ok: true }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'conflict'; existing: ActiveFocusSession }

/** Clears only the reserved unfinished-session settings record under shared Web Lock. */
export async function clearActiveFocusSession(context: DatabaseMutationContext): Promise<void> {
  await withGuardedMutation(context, async () => {
    await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
  })
}

/**
 * Atomically removes the unfinished singleton when the persisted id matches and generation matches.
 * Never writes study-history rows.
 */
export async function discardActiveFocusSession(
  sessionId: string,
  context: DatabaseMutationContext,
): Promise<DiscardActiveFocusSessionResult> {
  if (!sessionId) return { ok: false, reason: 'missing' }

  return withGuardedMutation(context, () =>
    studyDb.transaction('rw', studyDb.settings, async () => {
      const existingRecord = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
      if (!existingRecord) return { ok: false, reason: 'missing' }

      const existing = normalizeActiveFocusSession(existingRecord.value)
      if (!existing) {
        await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
        return { ok: false, reason: 'missing' }
      }

      if (existing.id !== sessionId) {
        return { ok: false, reason: 'conflict', existing }
      }

      await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
      return { ok: true }
    }),
  )
}

/**
 * Atomically pauses a running unfinished session under generation guard.
 * Clamps pausedAt to >= startedAt and durably commits the authoritative logical elapsed duration.
 */
export async function pauseActiveFocusSession(
  sessionId: string,
  pausedAtOrOptionsOrContext?: string | PauseActiveFocusSessionOptions | DatabaseMutationContext,
  maybeContext?: DatabaseMutationContext,
): Promise<TransitionActiveFocusSessionResult> {
  let context: DatabaseMutationContext
  let requestedPausedAt: string | undefined
  let logicalElapsedMs: number | undefined

  if (
    typeof pausedAtOrOptionsOrContext === 'object' &&
    pausedAtOrOptionsOrContext !== null &&
    'expectedGeneration' in pausedAtOrOptionsOrContext
  ) {
    context = pausedAtOrOptionsOrContext
  } else if (typeof pausedAtOrOptionsOrContext === 'object' && pausedAtOrOptionsOrContext !== null) {
    requestedPausedAt = pausedAtOrOptionsOrContext.pausedAt
    logicalElapsedMs = pausedAtOrOptionsOrContext.logicalElapsedMs
    context = maybeContext!
  } else if (typeof pausedAtOrOptionsOrContext === 'string') {
    requestedPausedAt = pausedAtOrOptionsOrContext
    context = maybeContext!
  } else {
    context = maybeContext!
  }

  const pausedAt = (requestedPausedAt && isIsoTimestamp(requestedPausedAt)) ? requestedPausedAt : nowIso()

  if (!sessionId || !isIsoTimestamp(pausedAt)) return { ok: false, reason: 'missing' }

  return withGuardedMutation(context, () =>
    studyDb.transaction('rw', studyDb.settings, async () => {
      const existingRecord = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
      if (!existingRecord) return { ok: false, reason: 'missing' }

      const existing = normalizeActiveFocusSession(existingRecord.value)
      if (!existing) {
        await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
        return { ok: false, reason: 'missing' }
      }

      if (existing.id !== sessionId) {
        return { ok: false, reason: 'conflict', existing }
      }
      if (existing.status !== 'running') {
        return { ok: false, reason: 'invalid_state', existing }
      }

      const startedAtMs = Date.parse(existing.startedAt)
      const rawPausedAtMs = Date.parse(pausedAt)
      const safePausedAtMs = Math.max(startedAtMs, rawPausedAtMs)
      const safePausedAt = new Date(safePausedAtMs).toISOString()

      const currentDurable = existing.checkpointElapsedMs ?? getActiveFocusElapsedMs(existing, safePausedAtMs)
      const callerElapsed = (typeof logicalElapsedMs === 'number' && Number.isFinite(logicalElapsedMs) && logicalElapsedMs >= 0)
        ? Math.floor(logicalElapsedMs)
        : currentDurable
      const effectiveCheckpoint = Math.max(currentDurable, callerElapsed)

      const session: ActiveFocusSession = {
        ...existing,
        status: 'paused',
        pausedAt: safePausedAt,
        checkpointElapsedMs: effectiveCheckpoint,
      }
      await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: session })
      return { ok: true, session }
    }),
  )
}

/**
 * Atomically resumes a paused unfinished session under generation guard.
 * Adds the full pause interval to `accumulatedPausedMs` and clears `pausedAt`.
 * Preserves the confirmed `checkpointElapsedMs`.
 */
export async function resumeActiveFocusSession(
  sessionId: string,
  resumedAtMsOrContext?: number | DatabaseMutationContext,
  maybeContext?: DatabaseMutationContext,
): Promise<TransitionActiveFocusSessionResult> {
  const context = (typeof resumedAtMsOrContext === 'object' && resumedAtMsOrContext !== null && 'expectedGeneration' in resumedAtMsOrContext)
    ? resumedAtMsOrContext
    : maybeContext!
  const resumedAtMs = (typeof resumedAtMsOrContext === 'number' && Number.isFinite(resumedAtMsOrContext))
    ? resumedAtMsOrContext
    : Date.now()

  if (!sessionId) return { ok: false, reason: 'missing' }

  return withGuardedMutation(context, () =>
    studyDb.transaction('rw', studyDb.settings, async () => {
      const existingRecord = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
      if (!existingRecord) return { ok: false, reason: 'missing' }

      const existing = normalizeActiveFocusSession(existingRecord.value)
      if (!existing) {
        await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
        return { ok: false, reason: 'missing' }
      }

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
        checkpointElapsedMs: existing.checkpointElapsedMs ?? getActiveFocusElapsedMs(existing, resumedAtMs),
      }
      await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: session })
      return { ok: true, session }
    }),
  )
}

/**
 * Atomically writes one study-history row (id = focus session id) and clears the
 * unfinished singleton when the persisted active session id matches and generation matches.
 * Safe to call repeatedly for the same session id.
 * Enforces transactional subject referential integrity and F-08 domain invariants.
 */
export async function finalizeActiveFocusSession(
  sessionId: string,
  history: Omit<StudySession, 'id'>,
  context: DatabaseMutationContext,
): Promise<FinalizeActiveFocusSessionResult> {
  if (!sessionId) return { ok: false, reason: 'missing' }

  return withGuardedMutation(context, () =>
    studyDb.transaction('rw', studyDb.subjects, studyDb.settings, studyDb.studySessions, async () => {
      const existingHistory = await studyDb.studySessions.get(sessionId)
      const activeRecord = await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)
      const activeSession = activeRecord ? normalizeActiveFocusSession(activeRecord.value) : null

      if (activeSession && activeSession.id !== sessionId) {
        return { ok: false, reason: 'conflict', existing: activeSession }
      }

      if (activeSession && activeSession.id === sessionId) {
        // If sessionId already exists in studySessions, re-key the active singleton
        // to a fresh canonical ID rather than overwriting foreign history or losing active study time.
        if (existingHistory) {
          let freshId = createId('focus')
          let attempts = 0
          while (await studyDb.studySessions.get(freshId)) {
            attempts++
            if (attempts > 5) {
              throw new Error('Exhausted unique ID generation attempts')
            }
            freshId = createId('focus')
          }

          const rekeyedSession: ActiveFocusSession = {
            ...activeSession,
            id: freshId,
          }
          await studyDb.settings.put({
            key: ACTIVE_FOCUS_SESSION_KEY,
            value: rekeyedSession,
          })
          return { ok: false, reason: 'id_rekeyed', session: rekeyedSession }
        }

        try {
          await assertSubjectExists(history.subjectId)
          if (activeSession.subjectId !== history.subjectId) {
            await assertSubjectExists(activeSession.subjectId)
          }
        } catch (err) {
          if (isSubjectNotFoundError(err)) {
            return { ok: false, reason: 'missing_subject' }
          }
          throw err
        }

        const safeStartedAt = isIsoTimestamp(history.startedAt) ? history.startedAt : activeSession.startedAt
        const startedAtMs = Date.parse(safeStartedAt)
        const rawEndedAtMs = isIsoTimestamp(history.endedAt) ? Date.parse(history.endedAt) : Date.now()
        const safeEndedAtMs = Math.max(startedAtMs, rawEndedAtMs)
        const safeEndedAt = new Date(safeEndedAtMs).toISOString()
        const safeMinutes = Math.max(1, Math.floor(history.minutes))

        const historyRow: StudySession = {
          id: sessionId,
          subjectId: history.subjectId,
          startedAt: safeStartedAt,
          endedAt: safeEndedAt,
          minutes: safeMinutes,
          note: typeof history.note === 'string' ? history.note : 'Focus session',
        }

        assertStudySessionWriteFields(historyRow)

        await studyDb.studySessions.add(historyRow)
        await studyDb.settings.delete(ACTIVE_FOCUS_SESSION_KEY)
        return { ok: true, history: historyRow }
      }

      // Active session already cleared / absent
      return { ok: false, reason: 'missing' }
    }),
  )
}
