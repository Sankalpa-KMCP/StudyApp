import { beforeEach, describe, expect, it } from 'vitest'
import {
  ACTIVE_FOCUS_SESSION_KEY,
  ACTIVE_FOCUS_SESSION_STALE_AFTER_MS,
  clearActiveFocusSession,
  createActiveFocusSession,
  discardActiveFocusSession,
  finalizeActiveFocusSession,
  getActiveFocusElapsedMs,
  getActiveFocusSession,
  getActiveFocusSessionWithGeneration,
  isActiveFocusSession,
  isActiveFocusSessionStale,
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
    })
  })

  describe('getActiveFocusElapsedMs', () => {
    it('derives running elapsed time from timestamps', () => {
      const nowMs = STARTED_AT_MS + 10 * 60_000
      expect(getActiveFocusElapsedMs(makeSession({ accumulatedPausedMs: 120_000 }), nowMs)).toBe(8 * 60_000)
    })

    it('derives paused elapsed time from the pause timestamp', () => {
      const pausedAt = '2026-07-20T10:20:00.000Z'
      const session = makeSession({
        status: 'paused',
        pausedAt,
        accumulatedPausedMs: 60_000,
      })
      const laterNow = Date.parse(pausedAt) + 30 * 60_000
      expect(getActiveFocusElapsedMs(session, laterNow)).toBe(19 * 60_000)
    })

    it('never returns a negative elapsed value when the clock skews', () => {
      const session = makeSession({ accumulatedPausedMs: 60 * 60_000 })
      expect(getActiveFocusElapsedMs(session, STARTED_AT_MS + 10_000)).toBe(0)
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

    it('excludes accumulated paused time from eligibility', () => {
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

  it('persists and reads a valid unfinished session with generation', async () => {
    const session = makeSession()
    const created = await createActiveFocusSession(session)
    expect(created).toEqual({ ok: true, session, generation: 1 })
    expect(await getActiveFocusSession()).toEqual(session)

    const withGen = await getActiveFocusSessionWithGeneration()
    expect(withGen).toEqual({ session, generation: 1 })
  })

  it('ignores and removes malformed persisted values without throwing', async () => {
    await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: { broken: true } })
    await expect(getActiveFocusSession()).resolves.toBeNull()
    expect(await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)).toBeUndefined()
  })

  it('does not silently overwrite an existing valid singleton session', async () => {
    const existing = makeSession({ id: 'focus-existing' })
    await createActiveFocusSession(existing)

    const conflict = await createActiveFocusSession(makeSession({ id: 'focus-new' }))
    expect(conflict).toEqual({ ok: false, reason: 'conflict', existing })
    expect(await getActiveFocusSession()).toEqual(existing)
  })

  it('replaces a corrupt settings value when creating a valid session', async () => {
    await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: 'corrupt' })
    const session = makeSession()
    expect(await createActiveFocusSession(session)).toEqual({ ok: true, session, generation: 1 })
    expect(await getActiveFocusSession()).toEqual(session)
  })

  it('updates only the reserved settings record for a matching session id', async () => {
    await createActiveFocusSession(makeSession())
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
    await createActiveFocusSession(session)
    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 2 })

    await expect(updateActiveFocusSession(session, { expectedGeneration: 1 })).rejects.toThrow(StaleDatabaseGenerationError)
  })

  it('clears only the unfinished session settings record', async () => {
    await createActiveFocusSession(makeSession())
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 180 })
    await studyDb.settings.put({ key: 'quickNotes', value: ['Keep me'] })

    await clearActiveFocusSession()

    expect(await getActiveFocusSession()).toBeNull()
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(180)
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual(['Keep me'])
  })

  it('removes the unfinished session on clear-all while preserving preference keys', async () => {
    await createActiveFocusSession(makeSession())
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
    await createActiveFocusSession(session)

    const snapshot = await exportStudyData()
    expect(snapshot.settings).toContainEqual({ key: ACTIVE_FOCUS_SESSION_KEY, value: session })

    await clearAllStudyData()
    expect(await getActiveFocusSession()).toBeNull()

    await importStudyData(snapshot)
    expect(await getActiveFocusSession()).toEqual(session)
  })

  it('rejects invalid create/update payloads', async () => {
    expect(await createActiveFocusSession(makeSession({ id: '' }))).toEqual({ ok: false, reason: 'invalid' })
    expect(await updateActiveFocusSession(makeSession(), { expectedGeneration: 1 })).toEqual({ ok: false, reason: 'missing' })
  })

  it('finalizes a matching session into one history row and clears the unfinished record', async () => {
    const session = makeSession()
    await createActiveFocusSession(session)

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
    await createActiveFocusSession(session)
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
    await createActiveFocusSession(session)

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
    await createActiveFocusSession(existing)

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
    await createActiveFocusSession(session)

    const pausedAt = '2026-07-20T10:10:00.000Z'
    const paused = await pauseActiveFocusSession(session.id, pausedAt, { expectedGeneration: 1 })
    expect(paused).toEqual({
      ok: true,
      session: {
        ...session,
        status: 'paused',
        pausedAt,
      },
    })
    expect(await getActiveFocusSession()).toMatchObject({ status: 'paused', pausedAt })

    const resumedAtMs = Date.parse(pausedAt) + 5 * 60_000
    const resumed = await resumeActiveFocusSession(session.id, resumedAtMs, { expectedGeneration: 1 })
    expect(resumed).toEqual({
      ok: true,
      session: {
        ...session,
        status: 'running',
        pausedAt: null,
        accumulatedPausedMs: 5 * 60_000,
      },
    })
    expect(getActiveFocusElapsedMs((resumed as { ok: true; session: ActiveFocusSession }).session, resumedAtMs + 2 * 60_000)).toBe(12 * 60_000)
  })

  it('rejects pause/resume when status or identity does not match', async () => {
    const session = makeSession({ id: 'focus-guard' })
    await createActiveFocusSession(session)

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
    await createActiveFocusSession(session)
    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 2 })

    await expect(pauseActiveFocusSession(session.id, undefined, { expectedGeneration: 1 })).rejects.toThrow(StaleDatabaseGenerationError)
    await expect(resumeActiveFocusSession(session.id, undefined, { expectedGeneration: 1 })).rejects.toThrow(StaleDatabaseGenerationError)
  })

  it('discards only a matching unfinished session without writing history', async () => {
    const session = makeSession({ id: 'focus-discard' })
    await createActiveFocusSession(session)

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
    await createActiveFocusSession(session)
    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 2 })

    await expect(discardActiveFocusSession(session.id, { expectedGeneration: 1 })).rejects.toThrow(StaleDatabaseGenerationError)
    expect(await getActiveFocusSession()).toEqual(session)
  })

  describe('referential integrity and race prevention', () => {
    it('createActiveFocusSession rejects missing subject and writes nothing to settings', async () => {
      const session = makeSession({ subjectId: 'subject-nonexistent' })
      const result = await createActiveFocusSession(session)
      expect(result).toEqual({ ok: false, reason: 'missing_subject' })
      expect(await getActiveFocusSession()).toBeNull()
      expect(await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)).toBeUndefined()
    })

    it('updateActiveFocusSession rejects missing subject and preserves the current settings record', async () => {
      const session = makeSession({ subjectId: 'subject-math' })
      await createActiveFocusSession(session)

      const updateAttempt = { ...session, subjectId: 'subject-nonexistent' }
      const result = await updateActiveFocusSession(updateAttempt, { expectedGeneration: 1 })
      expect(result).toEqual({ ok: false, reason: 'missing_subject' })
      expect(await getActiveFocusSession()).toEqual(session)
    })

    it('finalizeActiveFocusSession rejects missing subject, logs no study time, and preserves active record', async () => {
      const session = makeSession({ subjectId: 'subject-math' })
      await createActiveFocusSession(session)

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
      expect(await createActiveFocusSession(session)).toEqual({ ok: true, session, generation: 1 })

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
      await createActiveFocusSession(session)

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
      const result = await createActiveFocusSession(session)
      expect(result).toEqual({ ok: false, reason: 'missing_subject' })
      expect(await getActiveFocusSession()).toBeNull()
    })
  })
})
