import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ACTIVE_FOCUS_SESSION_KEY,
  ACTIVE_FOCUS_SESSION_STALE_AFTER_MS,
  checkpointActiveFocusSession,
  clearActiveFocusSession,
  createActiveFocusSession,
  discardActiveFocusSession,
  finalizeActiveFocusSession,
  getActiveFocusElapsedMs,
  getActiveFocusSession,
  getActiveFocusSessionWithGeneration,
  isActiveFocusSession,
  isActiveFocusSessionStale,
  normalizeActiveFocusSession,
  pauseActiveFocusSession,
  resumeActiveFocusSession,
  shouldAutoCompleteFocusSession,
  updateActiveFocusSession,
} from './activeFocusSession'
import { DATABASE_GENERATION_KEY, StaleDatabaseGenerationError } from './databaseGeneration'
import { installInMemoryLockAdapter } from './crossTabLock'
import { clearAllStudyData, exportStudyData, importStudyData, studyDb } from './studyDb'
import type { ActiveFocusSession } from './types'

const STARTED_AT = '2026-07-20T10:00:00.000Z'
const STARTED_AT_MS = Date.parse(STARTED_AT)

function makeSession(overrides: Partial<ActiveFocusSession> = {}): ActiveFocusSession {
  return {
    id: 'focus-1',
    subjectId: 'subject-math',
    startedAt: STARTED_AT,
    plannedMinutes: 25,
    status: 'running',
    pausedAt: null,
    accumulatedPausedMs: 0,
    ...overrides,
  }
}

describe('activeFocusSession domain', () => {
  beforeEach(async () => {
    installInMemoryLockAdapter()
  })

  describe('isActiveFocusSession', () => {
    it('accepts a valid running session', () => {
      expect(isActiveFocusSession(makeSession())).toBe(true)
    })

    it('accepts a valid paused session', () => {
      expect(isActiveFocusSession(makeSession({
        status: 'paused',
        pausedAt: '2026-07-20T10:15:00.000Z',
        accumulatedPausedMs: 60_000,
      }))).toBe(true)
    })

    it('accepts an empty subjectId for General focus', () => {
      expect(isActiveFocusSession(makeSession({ subjectId: '' }))).toBe(true)
    })

    it('rejects invalid ids, timestamps, durations, pause combinations, and statuses', () => {
      expect(isActiveFocusSession(makeSession({ id: '' }))).toBe(false)
      expect(isActiveFocusSession(makeSession({ startedAt: 'not-a-date' }))).toBe(false)
      expect(isActiveFocusSession(makeSession({ plannedMinutes: -1 }))).toBe(false)
      expect(isActiveFocusSession(makeSession({ plannedMinutes: Number.NaN }))).toBe(false)
      expect(isActiveFocusSession(makeSession({ status: 'stopped' as 'running' }))).toBe(false)
      expect(isActiveFocusSession(makeSession({ status: 'running', pausedAt: '2026-07-20T10:05:00.000Z' }))).toBe(false)
      expect(isActiveFocusSession(makeSession({ status: 'paused', pausedAt: null }))).toBe(false)
      expect(isActiveFocusSession(makeSession({
        status: 'paused',
        pausedAt: '2026-07-20T09:00:00.000Z',
      }))).toBe(false)
      expect(isActiveFocusSession(makeSession({ accumulatedPausedMs: -1 }))).toBe(false)
      expect(isActiveFocusSession(null)).toBe(false)
      expect(isActiveFocusSession({ ...makeSession(), extra: true })).toBe(true)
      expect(isActiveFocusSession(makeSession({ checkpointElapsedMs: 300_000 }))).toBe(true)
      expect(isActiveFocusSession(makeSession({ checkpointElapsedMs: -1 }))).toBe(false)
      expect(isActiveFocusSession(makeSession({ checkpointElapsedMs: Number.NaN }))).toBe(false)
      expect(isActiveFocusSession(makeSession({ checkpointElapsedMs: Number.POSITIVE_INFINITY }))).toBe(false)
    })
  })

  describe('normalizeActiveFocusSession', () => {
    it('normalizes a valid running session', () => {
      const valid = makeSession({ checkpointElapsedMs: 120_000 })
      expect(normalizeActiveFocusSession(valid)).toEqual(valid)
    })

    it('normalizes a valid paused session', () => {
      const valid = makeSession({
        status: 'paused',
        pausedAt: '2026-07-20T10:15:00.000Z',
        accumulatedPausedMs: 0,
        checkpointElapsedMs: 900_000,
      })
      expect(normalizeActiveFocusSession(valid)).toEqual(valid)
    })

    it('heals the legacy rollback anomaly (pausedAt < startedAt) by clamping pausedAt to startedAt', () => {
      const anomaly = makeSession({
        status: 'paused',
        pausedAt: '2026-07-20T09:45:00.000Z', // 15 mins before startedAt
        accumulatedPausedMs: 0,
      })
      const healed = normalizeActiveFocusSession(anomaly)
      expect(healed).not.toBeNull()
      expect(healed?.status).toBe('paused')
      expect(healed?.pausedAt).toBe(STARTED_AT) // healed to startedAt
      expect(isActiveFocusSession(healed)).toBe(true)
    })

    it('rejects genuinely corrupt or invalid shapes', () => {
      expect(normalizeActiveFocusSession(null)).toBeNull()
      expect(normalizeActiveFocusSession({})).toBeNull()
      expect(normalizeActiveFocusSession({ id: '' })).toBeNull()
      expect(normalizeActiveFocusSession(makeSession({ status: 'invalid' as 'running' }))).toBeNull()
      expect(normalizeActiveFocusSession(makeSession({ status: 'running', pausedAt: '2026-07-20T10:05:00.000Z' }))).toBeNull()
      expect(normalizeActiveFocusSession(makeSession({ status: 'paused', pausedAt: 'not-a-date' }))).toBeNull()
      expect(normalizeActiveFocusSession(makeSession({ accumulatedPausedMs: -5 }))).toBeNull()
      expect(normalizeActiveFocusSession(makeSession({ plannedMinutes: -1 }))).toBeNull()
    })
  })

  describe('getActiveFocusElapsedMs', () => {
    it('derives running elapsed time from timestamps for legacy uncheckpointed records', () => {
      const nowMs = STARTED_AT_MS + 10 * 60_000
      expect(getActiveFocusElapsedMs(makeSession({ accumulatedPausedMs: 120_000 }), nowMs)).toBe(8 * 60_000)
    })

    it('derives paused elapsed time from the pause timestamp for legacy uncheckpointed records', () => {
      const pausedAt = '2026-07-20T10:20:00.000Z'
      const session = makeSession({
        status: 'paused',
        pausedAt,
        accumulatedPausedMs: 60_000,
      })
      const laterNow = Date.parse(pausedAt) + 30 * 60_000
      expect(getActiveFocusElapsedMs(session, laterNow)).toBe(19 * 60_000)
    })

    it('never returns a negative elapsed value when the clock skews on legacy uncheckpointed records', () => {
      const session = makeSession({ accumulatedPausedMs: 60 * 60_000 })
      expect(getActiveFocusElapsedMs(session, STARTED_AT_MS + 10_000)).toBe(0)
    })

    it('returns exactly checkpointElapsedMs for checkpointed running session regardless of wall-clock time', () => {
      const checkpoint30m = 30 * 60_000
      const session = makeSession({
        checkpointElapsedMs: checkpoint30m,
        status: 'running',
      })

      // 1. Checkpoint 30m + wall-derived 20m (rollback) -> returns 30m
      const wall20m = STARTED_AT_MS + 20 * 60_000
      expect(getActiveFocusElapsedMs(session, wall20m)).toBe(checkpoint30m)

      // 2. Checkpoint 30m + ordinary later wall-derived 35m without new checkpoint -> remains 30m
      const wall35m = STARTED_AT_MS + 35 * 60_000
      expect(getActiveFocusElapsedMs(session, wall35m)).toBe(checkpoint30m)

      // 3. Checkpoint 30m + forward wall jump to 45m -> remains 30m (zero wall-time inflation)
      const wall45m = STARTED_AT_MS + 45 * 60_000
      expect(getActiveFocusElapsedMs(session, wall45m)).toBe(checkpoint30m)

      // 8. Backward rollback to before start -> still returns 30m
      const wallBeforeStart = STARTED_AT_MS - 60 * 60_000
      expect(getActiveFocusElapsedMs(session, wallBeforeStart)).toBe(checkpoint30m)
    })

    it('returns exactly checkpointElapsedMs for checkpointed paused session', () => {
      const checkpoint15m = 15 * 60_000
      const session = makeSession({
        status: 'paused',
        pausedAt: '2026-07-20T10:10:00.000Z',
        checkpointElapsedMs: checkpoint15m,
      })

      // 9. Paused checkpoint remains frozen at 15m regardless of query nowMs
      expect(getActiveFocusElapsedMs(session, STARTED_AT_MS + 5 * 60_000)).toBe(checkpoint15m)
      expect(getActiveFocusElapsedMs(session, STARTED_AT_MS + 60 * 60_000)).toBe(checkpoint15m)
    })
  })

  describe('isActiveFocusSessionStale', () => {
    it('is false before the 12-hour boundary and true at or beyond it', () => {
      const session = makeSession()
      expect(isActiveFocusSessionStale(session, STARTED_AT_MS + ACTIVE_FOCUS_SESSION_STALE_AFTER_MS - 1)).toBe(false)
      expect(isActiveFocusSessionStale(session, STARTED_AT_MS + ACTIVE_FOCUS_SESSION_STALE_AFTER_MS)).toBe(true)
      expect(isActiveFocusSessionStale(session, STARTED_AT_MS + ACTIVE_FOCUS_SESSION_STALE_AFTER_MS + 1)).toBe(true)
    })
  })

  describe('shouldAutoCompleteFocusSession', () => {
    const plannedMs = 25 * 60_000

    it('returns true for a running timed session exactly at the active-time boundary', () => {
      expect(shouldAutoCompleteFocusSession(makeSession(), STARTED_AT_MS + plannedMs)).toBe(true)
    })

    it('returns true for a running timed session beyond the active-time boundary', () => {
      expect(shouldAutoCompleteFocusSession(makeSession(), STARTED_AT_MS + plannedMs + 1)).toBe(true)
    })

    it('returns false for a running timed session with active time remaining', () => {
      expect(shouldAutoCompleteFocusSession(makeSession(), STARTED_AT_MS + plannedMs - 1)).toBe(false)
    })

    it('does not complete a 40m plan from a 45m forward wall jump when checkpoint is 30m', () => {
      const session = makeSession({
        plannedMinutes: 40,
        checkpointElapsedMs: 30 * 60_000,
        status: 'running',
      })
      const wall45m = STARTED_AT_MS + 45 * 60_000
      // 4. shouldAutoCompleteFocusSession does not complete a 40m plan from the 45m wall jump
      expect(shouldAutoCompleteFocusSession(session, wall45m)).toBe(false)

      // Only completes when checkpointed elapsed reaches 40m
      const sessionCompleted = makeSession({
        plannedMinutes: 40,
        checkpointElapsedMs: 40 * 60_000,
        status: 'running',
      })
      expect(shouldAutoCompleteFocusSession(sessionCompleted, wall45m)).toBe(true)
    })

    it('returns false for a paused session even when wall time exceeds the plan', () => {
      const pausedAt = '2026-07-20T10:10:00.000Z'
      const session = makeSession({
        status: 'paused',
        pausedAt,
      })
      const wallBeyondPlan = STARTED_AT_MS + plannedMs + 60_000
      expect(shouldAutoCompleteFocusSession(session, wallBeyondPlan)).toBe(false)
    })

    it('returns false for an open-ended session', () => {
      expect(shouldAutoCompleteFocusSession(makeSession({ plannedMinutes: 0 }), STARTED_AT_MS + 60 * 60_000)).toBe(false)
    })

    it('excludes accumulated paused time from eligibility for legacy sessions', () => {
      const session = makeSession({ accumulatedPausedMs: 5 * 60_000 })
      // Wall span equals plan, but active elapsed is 20 minutes.
      expect(shouldAutoCompleteFocusSession(session, STARTED_AT_MS + plannedMs)).toBe(false)
      // Active elapsed reaches the plan only after five more wall minutes.
      expect(shouldAutoCompleteFocusSession(session, STARTED_AT_MS + plannedMs + 5 * 60_000)).toBe(true)
    })

    it('freezes eligibility while a current pause interval is open', () => {
      const pausedAt = '2026-07-20T10:20:00.000Z'
      const session = makeSession({
        status: 'paused',
        pausedAt,
        accumulatedPausedMs: 0,
      })
      // Active elapsed frozen at 20 minutes; wall time far past the 25-minute plan.
      expect(shouldAutoCompleteFocusSession(session, Date.parse(pausedAt) + 30 * 60_000)).toBe(false)
    })

    it('does not mutate the supplied session object', () => {
      const session = makeSession({ accumulatedPausedMs: 60_000 })
      const snapshot = structuredClone(session)
      shouldAutoCompleteFocusSession(session, STARTED_AT_MS + plannedMs)
      expect(session).toEqual(snapshot)
    })
  })
})

describe('activeFocusSession persistence', () => {
  beforeEach(async () => {
    installInMemoryLockAdapter()
    await studyDb.delete()
    await studyDb.open()
    await studyDb.subjects.add({
      id: 'subject-math',
      name: 'Mathematics',
      color: '#2563eb',
      targetHours: 10,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('persists and reads a valid unfinished session with generation', async () => {
    const session = makeSession()
    const created = await createActiveFocusSession(session, { expectedGeneration: 1 })
    expect(created).toEqual({ ok: true, session, generation: 1 })
    expect(await getActiveFocusSession()).toEqual(session)

    const withGen = await getActiveFocusSessionWithGeneration()
    expect(withGen).toEqual({ session, generation: 1 })
  })

  it('ignores malformed persisted values without mutating settings on read', async () => {
    await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: { broken: true } })
    await expect(getActiveFocusSession()).resolves.toBeNull()
    // Read-only contract: getActiveFocusSession does not write or delete settings
    expect(await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)).toBeDefined()

    const withGen = await getActiveFocusSessionWithGeneration()
    expect(withGen).toEqual({ session: null, generation: 1 })
  })

  it('propagates storage read failures from getActiveFocusSession and getActiveFocusSessionWithGeneration', async () => {
    const storageError = new Error('IndexedDB storage read error')
    vi.spyOn(studyDb.settings, 'get').mockImplementation(async (key: string) => {
      if (key === ACTIVE_FOCUS_SESSION_KEY) throw storageError
      return { key, value: 1 }
    })

    await expect(getActiveFocusSession()).rejects.toThrow('IndexedDB storage read error')
    await expect(getActiveFocusSessionWithGeneration()).rejects.toThrow('IndexedDB storage read error')
  })

  it('does not silently overwrite an existing valid singleton session', async () => {
    const existing = makeSession({ id: 'focus-existing' })
    await createActiveFocusSession(existing, { expectedGeneration: 1 })

    const conflict = await createActiveFocusSession(makeSession({ id: 'focus-new' }), { expectedGeneration: 1 })
    expect(conflict).toEqual({ ok: false, reason: 'conflict', existing })
    expect(await getActiveFocusSession()).toEqual(existing)
  })

  it('replaces a corrupt settings value when creating a valid session', async () => {
    await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: 'corrupt' })
    const session = makeSession()
    expect(await createActiveFocusSession(session, { expectedGeneration: 1 })).toEqual({ ok: true, session, generation: 1 })
    expect(await getActiveFocusSession()).toEqual(session)
  })

  it('updates only the reserved settings record for a matching session id', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 240 })

    const paused = makeSession({
      status: 'paused',
      pausedAt: '2026-07-20T10:10:00.000Z',
      accumulatedPausedMs: 0,
    })
    expect(await updateActiveFocusSession(paused, { expectedGeneration: 1 })).toEqual({ ok: true, session: paused })
    expect(await getActiveFocusSession()).toEqual(paused)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(240)

    expect(await updateActiveFocusSession(makeSession({ id: 'focus-other' }), { expectedGeneration: 1 })).toEqual({
      ok: false,
      reason: 'conflict',
      existing: paused,
    })
  })

  it('rejects updateActiveFocusSession when generation is stale', async () => {
    const session = makeSession()
    await createActiveFocusSession(session, { expectedGeneration: 1 })
    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 2 })

    await expect(updateActiveFocusSession(session, { expectedGeneration: 1 })).rejects.toThrow(StaleDatabaseGenerationError)
  })

  it('clears only the unfinished session settings record', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 180 })
    await studyDb.settings.put({ key: 'quickNotes', value: ['Keep me'] })

    await clearActiveFocusSession({ expectedGeneration: 1 })

    expect(await getActiveFocusSession()).toBeNull()
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(180)
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual(['Keep me'])
  })

  it('removes the unfinished session on clear-all while preserving preference keys', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 200 })
    await studyDb.settings.put({ key: 'legacy-localstorage-migrated-v1', value: true })
    await studyDb.settings.put({ key: 'quickNotes', value: ['temp'] })

    await clearAllStudyData()

    expect(await getActiveFocusSession()).toBeNull()
    expect(await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)).toBeUndefined()
    expect(await studyDb.settings.get('quickNotes')).toBeUndefined()
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(200)
    expect((await studyDb.settings.get('legacy-localstorage-migrated-v1'))?.value).toBe(true)
  })

  it('round-trips a valid active-session settings record through export/import', async () => {
    const session = makeSession({ subjectId: '', plannedMinutes: 0 })
    await createActiveFocusSession(session, { expectedGeneration: 1 })

    const snapshot = await exportStudyData()
    expect(snapshot.settings).toContainEqual({ key: ACTIVE_FOCUS_SESSION_KEY, value: session })

    await clearAllStudyData()
    expect(await getActiveFocusSession()).toBeNull()

    await importStudyData(snapshot)
    expect(await getActiveFocusSession()).toEqual(session)
  })

  it('rejects invalid create/update payloads', async () => {
    expect(await createActiveFocusSession(makeSession({ id: '' }), { expectedGeneration: 1 })).toEqual({ ok: false, reason: 'invalid' })
    expect(await updateActiveFocusSession(makeSession(), { expectedGeneration: 1 })).toEqual({ ok: false, reason: 'missing' })
  })

  it('finalizes a matching session into one history row and clears the unfinished record', async () => {
    const session = makeSession()
    await createActiveFocusSession(session, { expectedGeneration: 1 })

    const first = await finalizeActiveFocusSession(session.id, {
      subjectId: session.subjectId,
      startedAt: session.startedAt,
      endedAt: '2026-07-20T10:25:00.000Z',
      minutes: 25,
      note: 'Completed focus session',
    }, { expectedGeneration: 1 })
    expect(first).toEqual({
      ok: true,
      history: {
        id: session.id,
        subjectId: session.subjectId,
        startedAt: session.startedAt,
        endedAt: '2026-07-20T10:25:00.000Z',
        minutes: 25,
        note: 'Completed focus session',
      },
    })
    expect(await getActiveFocusSession()).toBeNull()
    expect(await studyDb.studySessions.toArray()).toHaveLength(1)

    const second = await finalizeActiveFocusSession(session.id, {
      subjectId: session.subjectId,
      startedAt: session.startedAt,
      endedAt: '2026-07-20T11:00:00.000Z',
      minutes: 99,
      note: 'Duplicate attempt',
    }, { expectedGeneration: 1 })
    expect(second).toEqual(first)
    expect(await studyDb.studySessions.toArray()).toHaveLength(1)
    expect((await studyDb.studySessions.get(session.id))?.minutes).toBe(25)
  })

  it('rejects finalizeActiveFocusSession when generation is stale and does not write history', async () => {
    const session = makeSession()
    await createActiveFocusSession(session, { expectedGeneration: 1 })
    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 2 })

    await expect(finalizeActiveFocusSession(session.id, {
      subjectId: session.subjectId,
      startedAt: session.startedAt,
      endedAt: '2026-07-20T10:25:00.000Z',
      minutes: 25,
      note: 'Completed focus session',
    }, { expectedGeneration: 1 })).rejects.toThrow(StaleDatabaseGenerationError)

    expect(await studyDb.studySessions.count()).toBe(0)
    expect(await getActiveFocusSession()).toEqual(session)
  })

  it('does not create duplicate history rows for repeated finalization', async () => {
    const session = makeSession({
      id: 'focus-idempotent',
      subjectId: '',
      plannedMinutes: 0,
      startedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    })
    await createActiveFocusSession(session, { expectedGeneration: 1 })

    const first = await finalizeActiveFocusSession(session.id, {
      subjectId: '',
      startedAt: session.startedAt,
      endedAt: new Date().toISOString(),
      minutes: 3,
      note: 'Focus session',
    }, { expectedGeneration: 1 })
    const second = await finalizeActiveFocusSession(session.id, {
      subjectId: '',
      startedAt: session.startedAt,
      endedAt: new Date().toISOString(),
      minutes: 99,
      note: 'Duplicate',
    }, { expectedGeneration: 1 })

    expect(first.ok).toBe(true)
    expect(second).toEqual(first)
    expect(await studyDb.studySessions.count()).toBe(1)
    expect(await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)).toBeUndefined()
  })

  it('refuses to finalize when a different unfinished session is persisted', async () => {
    const existing = makeSession({ id: 'focus-existing' })
    await createActiveFocusSession(existing, { expectedGeneration: 1 })

    const result = await finalizeActiveFocusSession('focus-other', {
      subjectId: '',
      startedAt: STARTED_AT,
      endedAt: '2026-07-20T10:25:00.000Z',
      minutes: 25,
      note: 'Wrong session',
    }, { expectedGeneration: 1 })
    expect(result).toEqual({ ok: false, reason: 'conflict', existing })
    expect(await getActiveFocusSession()).toEqual(existing)
    expect(await studyDb.studySessions.count()).toBe(0)
  })

  it('pauses a running session and resumes with accumulated paused time', async () => {
    const session = makeSession({ id: 'focus-pause' })
    await createActiveFocusSession(session, { expectedGeneration: 1 })

    const pausedAt = '2026-07-20T10:10:00.000Z'
    const paused = await pauseActiveFocusSession(session.id, pausedAt, { expectedGeneration: 1 })
    expect(paused).toEqual({
      ok: true,
      session: {
        ...session,
        status: 'paused',
        pausedAt,
        checkpointElapsedMs: 10 * 60_000,
      },
    })
    expect(await getActiveFocusSession()).toMatchObject({ status: 'paused', pausedAt, checkpointElapsedMs: 10 * 60_000 })

    const resumedAtMs = Date.parse(pausedAt) + 5 * 60_000
    const resumed = await resumeActiveFocusSession(session.id, resumedAtMs, { expectedGeneration: 1 })
    expect(resumed).toEqual({
      ok: true,
      session: {
        ...session,
        status: 'running',
        pausedAt: null,
        accumulatedPausedMs: 5 * 60_000,
        checkpointElapsedMs: 10 * 60_000,
      },
    })
    expect(getActiveFocusElapsedMs((resumed as { ok: true; session: ActiveFocusSession }).session, resumedAtMs + 2 * 60_000)).toBe(10 * 60_000)
  })

  it('rejects pause/resume when status or identity does not match', async () => {
    const session = makeSession({ id: 'focus-guard' })
    await createActiveFocusSession(session, { expectedGeneration: 1 })

    expect(await pauseActiveFocusSession('focus-other', undefined, { expectedGeneration: 1 })).toEqual({
      ok: false,
      reason: 'conflict',
      existing: session,
    })

    await pauseActiveFocusSession(session.id, '2026-07-20T10:05:00.000Z', { expectedGeneration: 1 })
    const paused = await getActiveFocusSession()
    expect(await pauseActiveFocusSession(session.id, undefined, { expectedGeneration: 1 })).toEqual({
      ok: false,
      reason: 'invalid_state',
      existing: paused,
    })

    expect(await resumeActiveFocusSession('focus-other', undefined, { expectedGeneration: 1 })).toEqual({
      ok: false,
      reason: 'conflict',
      existing: paused,
    })
  })

  it('rejects pause/resume when generation is stale', async () => {
    const session = makeSession({ id: 'focus-stale-pause' })
    await createActiveFocusSession(session, { expectedGeneration: 1 })
    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 2 })

    await expect(pauseActiveFocusSession(session.id, undefined, { expectedGeneration: 1 })).rejects.toThrow(StaleDatabaseGenerationError)
    await expect(resumeActiveFocusSession(session.id, undefined, { expectedGeneration: 1 })).rejects.toThrow(StaleDatabaseGenerationError)
  })

  it('discards only a matching unfinished session without writing history', async () => {
    const session = makeSession({ id: 'focus-discard' })
    await createActiveFocusSession(session, { expectedGeneration: 1 })

    expect(await discardActiveFocusSession('focus-other', { expectedGeneration: 1 })).toEqual({
      ok: false,
      reason: 'conflict',
      existing: session,
    })
    expect(await getActiveFocusSession()).toEqual(session)

    expect(await discardActiveFocusSession(session.id, { expectedGeneration: 1 })).toEqual({ ok: true })
    expect(await getActiveFocusSession()).toBeNull()
    expect(await studyDb.studySessions.count()).toBe(0)
    expect(await discardActiveFocusSession(session.id, { expectedGeneration: 1 })).toEqual({ ok: false, reason: 'missing' })
  })

  it('rejects discardActiveFocusSession when generation is stale', async () => {
    const session = makeSession({ id: 'focus-discard' })
    await createActiveFocusSession(session, { expectedGeneration: 1 })
    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 2 })

    await expect(discardActiveFocusSession(session.id, { expectedGeneration: 1 })).rejects.toThrow(StaleDatabaseGenerationError)
    expect(await getActiveFocusSession()).toEqual(session)
  })

  describe('referential integrity and race prevention', () => {
    it('createActiveFocusSession rejects missing subject and writes nothing to settings', async () => {
      const session = makeSession({ subjectId: 'subject-nonexistent' })
      const result = await createActiveFocusSession(session, { expectedGeneration: 1 })
      expect(result).toEqual({ ok: false, reason: 'missing_subject' })
      expect(await getActiveFocusSession()).toBeNull()
      expect(await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)).toBeUndefined()
    })

    it('updateActiveFocusSession rejects missing subject and preserves the current settings record', async () => {
      const session = makeSession({ subjectId: 'subject-math' })
      await createActiveFocusSession(session, { expectedGeneration: 1 })

      const updateAttempt = { ...session, subjectId: 'subject-nonexistent' }
      const result = await updateActiveFocusSession(updateAttempt, { expectedGeneration: 1 })
      expect(result).toEqual({ ok: false, reason: 'missing_subject' })
      expect(await getActiveFocusSession()).toEqual(session)
    })

    it('finalizeActiveFocusSession rejects missing subject, logs no study time, and preserves active record', async () => {
      const session = makeSession({ subjectId: 'subject-math' })
      await createActiveFocusSession(session, { expectedGeneration: 1 })

      // Delete subject directly under the active session
      await studyDb.subjects.delete('subject-math')

      const result = await finalizeActiveFocusSession(session.id, {
        subjectId: 'subject-math',
        startedAt: session.startedAt,
        endedAt: '2026-07-20T10:25:00.000Z',
        minutes: 25,
        note: 'Focus session',
      }, { expectedGeneration: 1 })

      expect(result).toEqual({ ok: false, reason: 'missing_subject' })
      expect(await studyDb.studySessions.count()).toBe(0)
      expect(await getActiveFocusSession()).toEqual(session)
    })

    it('create, update, and finalize all succeed with General focus (empty subjectId)', async () => {
      const session = makeSession({ id: 'focus-general', subjectId: '' })
      expect(await createActiveFocusSession(session, { expectedGeneration: 1 })).toEqual({ ok: true, session, generation: 1 })

      const updated = { ...session, plannedMinutes: 50 }
      expect(await updateActiveFocusSession(updated, { expectedGeneration: 1 })).toEqual({ ok: true, session: updated })

      const finalized = await finalizeActiveFocusSession(session.id, {
        subjectId: '',
        startedAt: session.startedAt,
        endedAt: '2026-07-20T10:50:00.000Z',
        minutes: 50,
        note: 'General focus session',
      }, { expectedGeneration: 1 })
      expect(finalized.ok).toBe(true)
      expect(await studyDb.studySessions.get(session.id)).toMatchObject({ subjectId: '', minutes: 50 })
      expect(await getActiveFocusSession()).toBeNull()
    })

    it('writer-first: active focus session blocks deleteSubject', async () => {
      const { deleteSubject } = await import('./subjectService')
      const session = makeSession({ subjectId: 'subject-math' })
      await createActiveFocusSession(session, { expectedGeneration: 1 })

      const deleteResult = await deleteSubject('subject-math', { expectedGeneration: 1 })
      expect(deleteResult).toEqual({
        ok: false,
        reason: 'linked',
        usage: {
          tasks: 0,
          notes: 0,
          events: 0,
          sessions: 0,
          activeFocus: 1,
        },
      })
      expect(await studyDb.subjects.get('subject-math')).toBeDefined()
      expect(await getActiveFocusSession()).toEqual(session)
    })

    it('delete-first: deleted subject blocks subsequent createActiveFocusSession', async () => {
      const { deleteSubject } = await import('./subjectService')
      await deleteSubject('subject-math', { expectedGeneration: 1 })
      expect(await studyDb.subjects.get('subject-math')).toBeUndefined()

      const session = makeSession({ subjectId: 'subject-math' })
      const result = await createActiveFocusSession(session, { expectedGeneration: 1 })
      expect(result).toEqual({ ok: false, reason: 'missing_subject' })
      expect(await getActiveFocusSession()).toBeNull()
    })

    describe('checkpointActiveFocusSession', () => {
      it('persists a valid progress checkpoint and enforces monotonic CAS on stale/lower writes', async () => {
        const session = makeSession({ id: 'focus-cp' })
        await createActiveFocusSession(session, { expectedGeneration: 1 })

        // Checkpoint 5 mins
        const res1 = await checkpointActiveFocusSession('focus-cp', 300_000, { expectedGeneration: 1 })
        expect(res1).toEqual({
          ok: true,
          session: { ...session, checkpointElapsedMs: 300_000 },
        })
        expect(await getActiveFocusSession()).toMatchObject({ checkpointElapsedMs: 300_000 })

        // Checkpoint 10 mins
        const res2 = await checkpointActiveFocusSession('focus-cp', 600_000, { expectedGeneration: 1 })
        expect(res2).toEqual({
          ok: true,
          session: { ...session, checkpointElapsedMs: 600_000 },
        })

        // Stale or lower write (4 mins) is a safe no-op (keeps 10 mins)
        const res3 = await checkpointActiveFocusSession('focus-cp', 240_000, { expectedGeneration: 1 })
        expect(res3).toEqual({
          ok: true,
          session: { ...session, checkpointElapsedMs: 600_000 },
        })
        expect(await getActiveFocusSession()).toMatchObject({ checkpointElapsedMs: 600_000 })
      })

      it('rejects invalid inputs, missing sessions, or paused sessions', async () => {
        const session = makeSession({ id: 'focus-cp-err' })
        await createActiveFocusSession(session, { expectedGeneration: 1 })

        expect(await checkpointActiveFocusSession('focus-cp-err', -100, { expectedGeneration: 1 })).toEqual({ ok: false, reason: 'invalid' })
        expect(await checkpointActiveFocusSession('focus-cp-err', Number.NaN, { expectedGeneration: 1 })).toEqual({ ok: false, reason: 'invalid' })
        expect(await checkpointActiveFocusSession('non-existent', 1000, { expectedGeneration: 1 })).toEqual({
          ok: false,
          reason: 'conflict',
          existing: session,
        })

        // Pause session
        await pauseActiveFocusSession('focus-cp-err', { expectedGeneration: 1 })
        const pausedRes = await checkpointActiveFocusSession('focus-cp-err', 5000, { expectedGeneration: 1 })
        expect(pausedRes.ok).toBe(false)
        if (!pausedRes.ok) {
          expect(pausedRes.reason).toBe('invalid_state')
        }
      })
    })

    describe('F-11 clock rollback safety in persistence', () => {
      it('pauses safely when wall clock rolls backward before pause (pausedAt < startedAt)', async () => {
        const session = makeSession({ id: 'focus-rollback-pause', startedAt: '2026-07-20T10:00:00.000Z' })
        await createActiveFocusSession(session, { expectedGeneration: 1 })

        // Wall clock moved backward to 09:45:00.000Z before user clicked Pause, but 10 minutes of active study elapsed
        const rollbackPausedAt = '2026-07-20T09:45:00.000Z'
        const pauseResult = await pauseActiveFocusSession('focus-rollback-pause', {
          pausedAt: rollbackPausedAt,
          logicalElapsedMs: 600_000, // 10 minutes
        }, { expectedGeneration: 1 })

        expect(pauseResult.ok).toBe(true)
        if (pauseResult.ok) {
          // pausedAt must be clamped to >= startedAt
          expect(pauseResult.session.pausedAt).toBe('2026-07-20T10:00:00.000Z')
          expect(pauseResult.session.checkpointElapsedMs).toBe(600_000)
          // The durable record is valid per isActiveFocusSession
          expect(isActiveFocusSession(pauseResult.session)).toBe(true)
        }

        const durable = await getActiveFocusSession()
        expect(durable).not.toBeNull()
        expect(durable?.status).toBe('paused')
        expect(durable?.checkpointElapsedMs).toBe(600_000)

        // Resuming must not treat the record as missing/corrupt
        const resumeResult = await resumeActiveFocusSession('focus-rollback-pause', Date.parse('2026-07-20T10:05:00.000Z'), { expectedGeneration: 1 })
        expect(resumeResult.ok).toBe(true)
        if (resumeResult.ok) {
          expect(resumeResult.session.status).toBe('running')
          expect(resumeResult.session.checkpointElapsedMs).toBe(600_000)
        }
      })

      it('resumes safely when wall clock rolls backward during pause (resumedAt < pausedAt)', async () => {
        const session = makeSession({ id: 'focus-rollback-resume' })
        await createActiveFocusSession(session, { expectedGeneration: 1 })
        await pauseActiveFocusSession('focus-rollback-resume', {
          pausedAt: '2026-07-20T10:10:00.000Z',
          logicalElapsedMs: 600_000,
        }, { expectedGeneration: 1 })

        // Resumed at a wall clock time BEFORE pausedAt (e.g. clock rolled back 30 mins)
        const rollbackResumedAt = Date.parse('2026-07-20T09:40:00.000Z')
        const resumeResult = await resumeActiveFocusSession('focus-rollback-resume', rollbackResumedAt, { expectedGeneration: 1 })
        expect(resumeResult.ok).toBe(true)
        if (resumeResult.ok) {
          // Accumulated paused ms should not decrease or become negative
          expect(resumeResult.session.accumulatedPausedMs).toBe(0)
          expect(resumeResult.session.checkpointElapsedMs).toBe(600_000)
          expect(isActiveFocusSession(resumeResult.session)).toBe(true)
        }
      })

      it('finalizes safely when wall clock rolls backward before stop (endedAt < startedAt)', async () => {
        const session = makeSession({ id: 'focus-rollback-fin', startedAt: '2026-07-20T10:00:00.000Z' })
        await createActiveFocusSession(session, { expectedGeneration: 1 })

        // Attempt finalizing with endedAt earlier than startedAt (due to wall-clock change)
        const rollbackEndedAt = '2026-07-20T09:50:00.000Z'
        const finalizeResult = await finalizeActiveFocusSession('focus-rollback-fin', {
          subjectId: 'subject-math',
          startedAt: session.startedAt,
          endedAt: rollbackEndedAt,
          minutes: 15,
          note: 'Rollback focus',
        }, { expectedGeneration: 1 })

        expect(finalizeResult.ok).toBe(true)
        if (finalizeResult.ok) {
          // endedAt must be clamped to >= startedAt to satisfy F-08 domain validation
          expect(Date.parse(finalizeResult.history.endedAt)).toBeGreaterThanOrEqual(Date.parse(session.startedAt))
          expect(finalizeResult.history.minutes).toBe(15)
        }

        const historyRecord = await studyDb.studySessions.get('focus-rollback-fin')
        expect(historyRecord).toBeDefined()
        expect(historyRecord?.minutes).toBe(15)
      })

      it('heals legacy corrupt records (pausedAt < startedAt) and blocks subject deletion', async () => {
        const { deleteSubject } = await import('./subjectService')
        // Directly inject an anomaly record into settings table
        await studyDb.settings.put({
          key: ACTIVE_FOCUS_SESSION_KEY,
          value: {
            id: 'focus-anomaly',
            subjectId: 'subject-math',
            startedAt: '2026-07-20T10:00:00.000Z',
            plannedMinutes: 25,
            status: 'paused',
            pausedAt: '2026-07-20T09:30:00.000Z', // anomaly: pausedAt < startedAt
            accumulatedPausedMs: 0,
          },
        })

        // getActiveFocusSession heals in memory without deleting
        const restored = await getActiveFocusSession()
        expect(restored).not.toBeNull()
        expect(restored?.status).toBe('paused')
        expect(restored?.pausedAt).toBe('2026-07-20T10:00:00.000Z')

        // deleteSubject recognizes the linked active session and is blocked
        const deleteRes = await deleteSubject('subject-math', { expectedGeneration: 1 })
        expect(deleteRes.ok).toBe(false)
        if (!deleteRes.ok) {
          expect(deleteRes.reason).toBe('linked')
          expect(deleteRes.usage.activeFocus).toBe(1)
        }
      })
    })

    describe('F-12 ID collision protection and zero-data-loss finalization', () => {
      it('createActiveFocusSession rejects when candidate ID already exists in studySessions', async () => {
        const existingHistory: StudySession = {
          id: 'focus-existing-history',
          subjectId: 'subject-math',
          startedAt: '2026-07-15T10:00:00.000Z',
          endedAt: '2026-07-15T10:30:00.000Z',
          minutes: 30,
          note: 'Old session',
        }
        await studyDb.studySessions.add(existingHistory)

        const session = makeSession({ id: 'focus-existing-history' })
        const result = await createActiveFocusSession(session, { expectedGeneration: 1 })

        expect(result).toEqual({
          ok: false,
          reason: 'id_collision',
        })
        expect(await getActiveFocusSession()).toBeNull()
      })

      it('finalizeActiveFocusSession re-keys and saves new session when colliding with existing history', async () => {
        // 1. Existing historical row in studySessions
        const existingHistory: StudySession = {
          id: 'focus-colliding-id',
          subjectId: 'subject-math',
          startedAt: '2026-07-15T10:00:00.000Z',
          endedAt: '2026-07-15T10:15:00.000Z',
          minutes: 15,
          note: 'Prior Chemistry session',
        }
        await studyDb.studySessions.add(existingHistory)

        await studyDb.subjects.add({
          id: 'subject-physics',
          name: 'Physics',
          color: '#0f766e',
          targetHours: 10,
          progress: 0,
          progressMode: 'manual',
          createdAt: '2026-07-20T00:00:00.000Z',
          updatedAt: '2026-07-20T00:00:00.000Z',
        })

        // 2. Active session started with colliding ID (e.g. from imported backup)
        const activeSession = makeSession({
          id: 'focus-colliding-id',
          subjectId: 'subject-physics',
          startedAt: '2026-07-20T14:00:00.000Z',
          plannedMinutes: 45,
          checkpointElapsedMs: 45 * 60_000,
        })
        await studyDb.settings.put({
          key: ACTIVE_FOCUS_SESSION_KEY,
          value: activeSession,
        })

        // 3. Finalize the active session
        const finalizeRes = await finalizeActiveFocusSession('focus-colliding-id', {
          subjectId: 'subject-physics',
          startedAt: '2026-07-20T14:00:00.000Z',
          endedAt: '2026-07-20T14:45:00.000Z',
          minutes: 45,
          note: 'Completed 45m Physics',
        }, { expectedGeneration: 1 })

        expect(finalizeRes.ok).toBe(true)
        if (finalizeRes.ok) {
          // Newly generated history row has unique ID and correct minutes/subject
          expect(finalizeRes.history.id).not.toBe('focus-colliding-id')
          expect(finalizeRes.history.subjectId).toBe('subject-physics')
          expect(finalizeRes.history.minutes).toBe(45)
          expect(finalizeRes.history.note).toBe('Completed 45m Physics')
        }

        // Active singleton cleared
        expect(await getActiveFocusSession()).toBeNull()

        // Total 2 study sessions in history: prior row intact + new row saved
        expect(await studyDb.studySessions.count()).toBe(2)
        const original = await studyDb.studySessions.get('focus-colliding-id')
        expect(original?.subjectId).toBe('subject-math')
        expect(original?.minutes).toBe(15)
      })

      it('finalizeActiveFocusSession returns existing history idempotently when active session is already cleared', async () => {
        const existingHistory: StudySession = {
          id: 'focus-finalized-once',
          subjectId: 'subject-math',
          startedAt: '2026-07-20T10:00:00.000Z',
          endedAt: '2026-07-20T10:25:00.000Z',
          minutes: 25,
          note: 'Focus session',
        }
        await studyDb.studySessions.add(existingHistory)

        // No active session in settings (already cleared)
        expect(await getActiveFocusSession()).toBeNull()

        const retryRes = await finalizeActiveFocusSession('focus-finalized-once', {
          subjectId: 'subject-math',
          startedAt: '2026-07-20T10:00:00.000Z',
          endedAt: '2026-07-20T10:25:00.000Z',
          minutes: 25,
          note: 'Focus session',
        }, { expectedGeneration: 1 })

        expect(retryRes).toEqual({
          ok: true,
          history: existingHistory,
        })
      })
    })
  })
})
