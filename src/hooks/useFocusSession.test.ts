import type { StudySession } from '../db/types'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as activeFocusSession from '../db/activeFocusSession'
import {
  ACTIVE_FOCUS_SESSION_STALE_AFTER_MS,
  createActiveFocusSession,
  getActiveFocusSession,
} from '../db/activeFocusSession'
import { DATABASE_GENERATION_KEY, getDatabaseGeneration } from '../db/databaseGeneration'
import { installInMemoryLockAdapter } from '../db/crossTabLock'
import * as studyDbModule from '../db/studyDb'
import { clearAllStudyData, studyDb } from '../db/studyDb'
import type { ActiveFocusSession, StudySubject } from '../db/types'
import { useFocusSession } from './useFocusSession'

function makeSession(overrides: Partial<ActiveFocusSession> = {}): ActiveFocusSession {
  return {
    id: 'focus-hook',
    subjectId: 'subject-a',
    startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    plannedMinutes: 25,
    status: 'running',
    pausedAt: null,
    accumulatedPausedMs: 0,
    ...overrides,
  }
}

describe('useFocusSession', () => {
  const subjectMap = new Map<string, StudySubject>([
    ['subject-a', {
      id: 'subject-a',
      name: 'Algebra',
      color: '#2563eb',
      targetHours: 4,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    }],
    ['subject-b', {
      id: 'subject-b',
      name: 'Biology',
      color: '#0f766e',
      targetHours: 4,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    }],
    ['subject-c', {
      id: 'subject-c',
      name: 'Chemistry',
      color: '#b45309',
      targetHours: 4,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    }],
  ])

  beforeEach(async () => {
    installInMemoryLockAdapter()
    vi.useRealTimers()
    vi.restoreAllMocks()
    await studyDb.delete()
    await studyDb.open()
    await studyDb.subjects.bulkAdd(Array.from(subjectMap.values()))
  })

  it.each([
    ['collision-capacity', false], ['collision-capacity', true], ['capacity', false], ['storage', false],
  ] as const)('does not relabel an obsolete anchor after automatic completion recovery (%s, rollback=%s)', async (failure, rollback) => {
    let mono = 0
    const wall = Date.now()
    vi.spyOn(performance, 'now').mockImplementation(() => mono)
    vi.spyOn(Date, 'now').mockImplementation(() => wall + (rollback ? 0 : mono))
    const session = makeSession({ startedAt: new Date(wall).toISOString(), checkpointElapsedMs: 600_000, plannedMinutes: 10, runToken: rollback ? 'initial-run' : undefined })
    const foreign = { id: session.id, subjectId: 'subject-a', startedAt: session.startedAt, endedAt: session.startedAt, minutes: 1, note: 'Foreign history' }
    if (failure === 'collision-capacity') await studyDb.studySessions.add(foreign)
    await studyDb.settings.put({ key: activeFocusSession.ACTIVE_FOCUS_SESSION_KEY, value: session })
    const realRead = activeFocusSession.getActiveFocusSession
    vi.spyOn(activeFocusSession, 'getActiveFocusSession').mockImplementationOnce(async () => {
      const paused = await activeFocusSession.pauseActiveFocusSession(session.id, { logicalElapsedMs: 600_000, observed: session }, { expectedGeneration: 1 })
      expect(paused.ok).toBe(true)
      mono = 300_000
      const resumed = await activeFocusSession.resumeActiveFocusSession(session.id, wall + (rollback ? -60_000 : mono), { expectedGeneration: 1 })
      expect(resumed.ok && resumed.session.runToken).toBeTruthy()
      return realRead()
    })
    const fillCapacity = async () => {
      const count = await studyDb.studySessions.count()
      await studyDb.studySessions.bulkAdd(Array.from({ length: 10_000 - count }, (_, index) => ({ ...foreign, id: `capacity-${index}` })))
    }
    const realFinalize = activeFocusSession.finalizeActiveFocusSession
    let storageBlocked = failure === 'storage'
    let markAttemptSettled: () => void = () => {}
    const attemptSettled = new Promise<void>(resolve => { markAttemptSettled = resolve })
    const observeFinalize = async (...args: Parameters<typeof realFinalize>) => {
      if (storageBlocked) { markAttemptSettled(); throw new Error('controlled storage failure') }
      const response = await realFinalize(...args)
      if (!response.ok && response.reason === 'capacity_limit') markAttemptSettled()
      return response
    }
    const finalize = vi.spyOn(activeFocusSession, 'finalizeActiveFocusSession').mockImplementation(observeFinalize)
    if (failure !== 'storage') finalize.mockImplementationOnce(async (...args) => {
      if (failure === 'capacity') await fillCapacity()
      const response = await observeFinalize(...args)
      if (!response.ok && response.reason === 'id_rekeyed') await fillCapacity()
      return response
    })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    // Real 10,000-row capacity setup can outlast waitFor's default polling budget.
    // Wait for the decisive transaction result, not an intermediate reconciliation notice.
    await attemptSettled
    await act(async () => {})
    await waitFor(() => expect(result.current.sessionNotice).toContain(failure === 'storage' ? 'Could not stop' : 'backup-safe capacity'))
    if (failure !== 'storage') expect(finalize).toHaveBeenCalledTimes(failure === 'collision-capacity' ? 2 : 1)
    expect(await realRead()).not.toBeNull()
    expect(result.current.activeSession?.runToken).toBe((await realRead())?.runToken)
    expect(result.current.elapsedSeconds).toBe(600)
    if (failure !== 'storage') {
      expect(await studyDb.studySessions.count()).toBe(10_000)
      await studyDb.studySessions.delete('capacity-0')
    }
    const retained = await studyDb.studySessions.toArray()
    storageBlocked = false
    await act(async () => { await result.current.stopSession() })
    expect(await realRead()).toBeNull()
    expect(result.current.activeSession).toBeNull()
    expect(result.current.sessionNotice).toBe('Session stopped: 10m logged.')
    const history = await studyDb.studySessions.toArray()
    const retainedIds = new Set(retained.map((row) => row.id))
    const added = history.filter((row) => !retainedIds.has(row.id))
    expect(added).toHaveLength(1)
    expect(added[0].minutes).toBe(10)
    if (failure === 'collision-capacity') expect(await studyDb.studySessions.get(foreign.id)).toEqual(foreign)
  })

  it('restores a running session and blocks Start until restore completes', async () => {
    await createActiveFocusSession(makeSession({ plannedMinutes: 40 }), { expectedGeneration: 1 })

    const { result } = renderHook(() => useFocusSession({ subjectMap }))

    await waitFor(() => expect(result.current.canStartFocus).toBe(false))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))
    expect(result.current.focusSubjectId).toBe('subject-a')
    expect(result.current.focusDurationMinutes).toBe(40)
    expect(result.current.staleFocusSession).toBeNull()
    expect(result.current.canStartFocus).toBe(false)
  })

  it.each(['capacity', 'storage'] as const)('retains same-interval active time after automatic %s rejection', async (failure) => {
    let mono = 0
    vi.spyOn(performance, 'now').mockImplementation(() => mono)
    const session = makeSession({ checkpointElapsedMs: 600_000, plannedMinutes: 10, runToken: 'unchanged-run' })
    await createActiveFocusSession(session, { expectedGeneration: 1 })
    if (failure === 'capacity') await studyDb.studySessions.bulkAdd(Array.from({ length: 10_000 }, (_, index) => ({
      id: `retained-${index}`, subjectId: 'subject-a', startedAt: session.startedAt, endedAt: session.startedAt, minutes: 1, note: '',
    })))
    const realFinalize = activeFocusSession.finalizeActiveFocusSession
    let storageBlocked = failure === 'storage'
    let markAttemptSettled: () => void = () => {}
    const attemptSettled = new Promise<void>(resolve => { markAttemptSettled = resolve })
    vi.spyOn(activeFocusSession, 'finalizeActiveFocusSession').mockImplementation(async (...args) => {
      if (storageBlocked) { markAttemptSettled(); throw new Error('controlled storage failure') }
      const response = await realFinalize(...args)
      if (!response.ok && response.reason === 'capacity_limit') markAttemptSettled()
      return response
    })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await attemptSettled
    await act(async () => {})
    await waitFor(() => expect(result.current.sessionNotice).toContain(failure === 'storage' ? 'Could not stop' : 'backup-safe capacity'))
    mono = 300_000
    storageBlocked = false
    if (failure === 'capacity') await studyDb.studySessions.delete('retained-0')
    await act(async () => { await result.current.stopSession() })
    expect(await getActiveFocusSession()).toBeNull()
    expect((await studyDb.studySessions.get(session.id))?.minutes).toBe(15)
    expect(result.current.sessionNotice).toBe('Session stopped: 15m logged.')
    expect(await studyDb.studySessions.count()).toBe(failure === 'capacity' ? 10_000 : 1)
  })

  it('restores a stale session into the stale slot only', async () => {
    await createActiveFocusSession(makeSession({
      startedAt: new Date(Date.now() - ACTIVE_FOCUS_SESSION_STALE_AFTER_MS).toISOString(),
    }), { expectedGeneration: 1 })

    const { result } = renderHook(() => useFocusSession({ subjectMap }))

    await waitFor(() => expect(result.current.staleFocusSession?.id).toBe('focus-hook'))
    expect(result.current.activeSession).toBeNull()
    expect(result.current.staleFocusSubjectName).toBe('Algebra')
    expect(result.current.canStartFocus).toBe(false)
  })

  it('holds the import lock through the awaited action and clears it afterward', async () => {
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.canStartFocus).toBe(true))

    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    const actionPromise = result.current.runWithFocusImportLock(async () => {
      await gate
      return 'ok'
    })

    await waitFor(() => expect(result.current.focusImportPending).toBe(true))
    expect(result.current.focusActionsPending).toBe(true)
    expect(result.current.canStartFocus).toBe(false)

    release()
    await expect(actionPromise).resolves.toBe('ok')
    await waitFor(() => expect(result.current.focusImportPending).toBe(false))
    expect(result.current.canStartFocus).toBe(true)
  })

  it('clears local focus slots without re-reading IndexedDB', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))

    act(() => {
      result.current.clearFocusLocalState()
    })

    expect(result.current.activeSession).toBeNull()
    expect(result.current.staleFocusSession).toBeNull()
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-hook' })
  })

  it('synchronizes post-clear generation in clearFocusLocalState allowing immediate startSession', async () => {
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.canStartFocus).toBe(true))

    // Advance generation via clearAllStudyData from 1 to 2
    const nextGen = await clearAllStudyData()
    expect(nextGen).toBe(2)

    act(() => {
      result.current.clearFocusLocalState(nextGen)
    })

    await act(async () => {
      await result.current.startSession()
    })

    expect(result.current.sessionNotice).toBe('')
    expect(result.current.activeSession).not.toBeNull()
    expect(result.current.activeSession?.status).toBe('running')
    const active = await getActiveFocusSession()
    expect(active?.id).toBe(result.current.activeSession?.id)
  })

  it('persists a successful focus subject update into the durable singleton', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))

    act(() => {
      result.current.updateFocusSubject('subject-b')
    })

    await waitFor(() => expect(result.current.activeSession?.subjectId).toBe('subject-b'))
    expect(result.current.focusSubjectId).toBe('subject-b')
    expect(result.current.sessionNotice).toBe('')
    expect(await getActiveFocusSession()).toMatchObject({
      id: 'focus-hook',
      subjectId: 'subject-b',
    })
  })

  it('hydrates the authoritative durable session when subject update conflicts', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    const elsewhere = makeSession({
      id: 'focus-elsewhere',
      subjectId: 'subject-c',
      plannedMinutes: 40,
    })
    const updateSpy = vi.spyOn(activeFocusSession, 'updateActiveFocusSessionSubject').mockResolvedValue({
      ok: false,
      reason: 'conflict',
      existing: elsewhere,
    })

    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))

    act(() => {
      result.current.updateFocusSubject('subject-b')
    })

    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-elsewhere'))
    expect(result.current.focusSubjectId).toBe('subject-c')
    expect(result.current.focusDurationMinutes).toBe(40)
    expect(result.current.sessionNotice).toBe('Focus session was updated elsewhere.')
    expect(updateSpy).toHaveBeenCalled()
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-hook', subjectId: 'subject-a' })
  })

  it('clears local focus instead of a ghost when the durable session is missing after an update', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))

    await studyDb.settings.delete(activeFocusSession.ACTIVE_FOCUS_SESSION_KEY)

    act(() => {
      result.current.updateFocusSubject('subject-b')
    })

    await waitFor(() => expect(result.current.sessionNotice).toBe('Focus session no longer exists.'))
    expect(result.current.activeSession).toBeNull()
    expect(result.current.focusSubjectId).toBe('subject-a')
    expect(await getActiveFocusSession()).toBeNull()
  })

  it('rehydrates a durable session when subject update returns missing but one still exists', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    const durable = makeSession({ subjectId: 'subject-a', plannedMinutes: 35 })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))

    vi.spyOn(activeFocusSession, 'updateActiveFocusSessionSubject').mockResolvedValue({
      ok: false,
      reason: 'missing',
    })
    vi.spyOn(activeFocusSession, 'getActiveFocusSession').mockResolvedValue(durable)

    act(() => {
      result.current.updateFocusSubject('subject-b')
    })

    await waitFor(() => expect(result.current.sessionNotice).toBe('Could not update the focus subject. Try again.'))
    expect(result.current.activeSession).toMatchObject({ id: 'focus-hook', subjectId: 'subject-a', plannedMinutes: 35 })
    expect(result.current.focusSubjectId).toBe('subject-a')
  })

  it('clears local focus instead of a ghost when subject persistence throws and no durable session remains', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))

    vi.spyOn(activeFocusSession, 'updateActiveFocusSessionSubject').mockRejectedValue(new Error('subject write failed'))
    vi.spyOn(activeFocusSession, 'getActiveFocusSession').mockResolvedValue(null)

    act(() => {
      result.current.updateFocusSubject('subject-b')
    })

    await waitFor(() => expect(result.current.sessionNotice).toBe('Focus session no longer exists.'))
    expect(result.current.activeSession).toBeNull()
    expect(result.current.focusSubjectId).toBe('subject-a')
  })

  it('rehydrates durable state when subject persistence throws but IndexedDB still has the session', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(activeFocusSession, 'updateActiveFocusSessionSubject').mockRejectedValue(new Error('subject write failed'))

    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))

    act(() => {
      result.current.updateFocusSubject('subject-b')
    })

    await waitFor(() => expect(result.current.sessionNotice).toBe('Could not update the focus subject. Try again.'))
    expect(result.current.activeSession).toMatchObject({ id: 'focus-hook', subjectId: 'subject-a' })
    expect(result.current.focusSubjectId).toBe('subject-a')
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-hook', subjectId: 'subject-a' })
  })

  it('does not mutate the durable subject while focus actions are pending', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    const updateSpy = vi.spyOn(activeFocusSession, 'updateActiveFocusSessionSubject')
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))

    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const lockPromise = result.current.runWithFocusImportLock(async () => {
      await gate
    })
    await waitFor(() => expect(result.current.focusActionsPending).toBe(true))
    updateSpy.mockClear()

    act(() => {
      result.current.updateFocusSubject('subject-b')
    })

    expect(result.current.focusSubjectId).toBe('subject-b')
    expect(result.current.activeSession?.subjectId).toBe('subject-a')
    expect(updateSpy).not.toHaveBeenCalled()
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-hook', subjectId: 'subject-a' })

    release()
    await lockPromise
    await waitFor(() => expect(result.current.focusActionsPending).toBe(false))
  })

  it('ignores an older subject-update settlement after a newer subject write is queued', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    let releaseFirst!: (result: activeFocusSession.UpdateActiveFocusSessionResult) => void
    const firstGate = new Promise<activeFocusSession.UpdateActiveFocusSessionResult>((resolve) => {
      releaseFirst = resolve
    })
    const realUpdate = activeFocusSession.updateActiveFocusSessionSubject
    const updateSpy = vi.spyOn(activeFocusSession, 'updateActiveFocusSessionSubject')
      .mockImplementationOnce(() => firstGate)
      .mockImplementation((session, context) => realUpdate(session, context))

    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))

    act(() => {
      result.current.updateFocusSubject('subject-b')
    })
    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1))

    act(() => {
      result.current.updateFocusSubject('subject-c')
    })
    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.activeSession?.subjectId).toBe('subject-c'))
    await waitFor(async () => {
      expect(await getActiveFocusSession()).toMatchObject({
        id: 'focus-hook',
        subjectId: 'subject-c',
      })
    })

    releaseFirst({
      ok: true,
      session: makeSession({ subjectId: 'subject-b' }),
    })

    await waitFor(() => expect(result.current.activeSession?.subjectId).toBe('subject-c'))
    expect(result.current.focusSubjectId).toBe('subject-c')
    expect(result.current.sessionNotice).toBe('')
    expect(await getActiveFocusSession()).toMatchObject({
      id: 'focus-hook',
      subjectId: 'subject-c',
    })
  })

  it('AC-1, AC-5: blocks focus start/pause/resume/stop/subject updates when coordinator is busy', async () => {
    const { DataOperationCoordinator } = await import('../db/dataCoordinator')
    const coordinator = new DataOperationCoordinator()

    // Lock the coordinator with an import
    let releaseImport!: () => void
    const importGate = new Promise<void>((resolve) => { releaseImport = resolve })
    void coordinator.runImport(async () => importGate)

    const createSpy = vi.spyOn(activeFocusSession, 'createActiveFocusSession')

    const { result } = renderHook(() => useFocusSession({ subjectMap, coordinator }))
    await waitFor(() => expect(result.current.canStartFocus).toBe(true))

    // Attempt startSession
    await act(async () => {
      await result.current.startSession()
    })

    expect(createSpy).not.toHaveBeenCalled()
    expect(result.current.sessionNotice).toBe('A data operation is currently in progress. Please wait.')

    releaseImport()
  })

  it('AC-4: permits focus writes during active Export', async () => {
    const { DataOperationCoordinator } = await import('../db/dataCoordinator')
    const coordinator = new DataOperationCoordinator()

    // Start an export
    let releaseExport!: () => void
    const exportGate = new Promise<void>((resolve) => { releaseExport = resolve })
    const exportTask = coordinator.runExport(async () => exportGate)

    const { result } = renderHook(() => useFocusSession({ subjectMap, coordinator }))
    await waitFor(() => expect(result.current.canStartFocus).toBe(true))

    await act(async () => {
      await result.current.startSession()
    })

    expect(result.current.activeSession).not.toBe(null)
    expect(result.current.sessionNotice).toBe('')

    releaseExport()
    await exportTask
  })

  it('notifies and prevents start when selected subject does not exist', async () => {
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.canStartFocus).toBe(true))

    act(() => {
      result.current.updateFocusSubject('non-existent-subject')
    })

    await act(async () => {
      await result.current.startSession()
    })

    expect(result.current.activeSession).toBeNull()
    expect(result.current.sessionNotice).toBe('The selected subject is no longer available.')
    expect(await getActiveFocusSession()).toBeNull()
  })

  it('reverts and notifies when updating active focus to a non-existent subject', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))

    act(() => {
      result.current.updateFocusSubject('non-existent-subject')
    })

    await waitFor(() => {
      expect(result.current.sessionNotice).toBe('The selected subject is no longer available.')
    })
    expect(result.current.focusSubjectId).toBe('subject-a')
    expect(result.current.activeSession?.subjectId).toBe('subject-a')
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-hook', subjectId: 'subject-a' })
  })

  it('preserves active focus state and notifies when stopping a session whose subject was deleted', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))

    // Delete subject directly under the active session
    await studyDb.subjects.delete('subject-a')

    await act(async () => {
      await result.current.stopSession()
    })

    expect(result.current.sessionNotice).toBe('The selected subject is no longer available. Study time was not logged.')
    expect(result.current.activeSession?.id).toBe('focus-hook')
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-hook', subjectId: 'subject-a' })
    expect(await studyDb.studySessions.count()).toBe(0)
  })

  it('clears active focus state and notifies when database generation advanced externally', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))

    // Advance generation externally (e.g. from clearAll or import in another tab)
    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 2 })

    await act(async () => {
      await result.current.pauseSession()
    })

    expect(result.current.activeSession).toBeNull()
    expect(result.current.sessionNotice).toBe(
      'The database was updated elsewhere.',
    )
  })

  it('rejects Start from retained workflow after database generation advances via clearAllStudyData and succeeds on fresh workflow', async () => {
    // 1. Establish Focus setup under generation G
    const initialGeneration = await getDatabaseGeneration(studyDb.settings)
    expect(initialGeneration).toBeGreaterThanOrEqual(1)

    const { result, unmount } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.canStartFocus).toBe(true))
    expect(result.current.activeSession).toBeNull()

    // 2. Retain the same hook/workflow instance across a real destructive production operation
    await clearAllStudyData()

    // 3. Verify the production operation advances durable generation to G+1
    const postClearGeneration = await getDatabaseGeneration(studyDb.settings)
    expect(postClearGeneration).toBe(initialGeneration + 1)

    // 4. Without recreating the stale hook first, invoke startSession from the retained G workflow
    await act(async () => {
      await result.current.startSession()
    })

    // 5. Verify stale rejection: user notice shown, no active session in hook, no active singleton in DB, no history row
    expect(result.current.sessionNotice).toBe('Data was modified in another tab or import. Refresh to continue.')
    expect(result.current.activeSession).toBeNull()
    expect(await getActiveFocusSession()).toBeNull()
    expect(await studyDb.studySessions.count()).toBe(0)

    unmount()

    // 6. Reinitialize a genuinely fresh workflow after the destructive operation (captures G+1)
    const freshHook = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(freshHook.result.current.canStartFocus).toBe(true))

    // 7. Invoke Start on fresh workflow and verify success
    await act(async () => {
      await freshHook.result.current.startSession()
    })

    // Verify Start succeeds under fresh generation and persists active singleton
    await waitFor(() => expect(freshHook.result.current.activeSession?.status).toBe('running'))
    expect(freshHook.result.current.sessionNotice).toBeFalsy()
    expect(await getActiveFocusSession()).toMatchObject({ status: 'running' })
  })

  it('handles initial restore failure by disabling Start Focus and setting storage error notice without unhandled rejection', async () => {
    const readError = new Error('IndexedDB storage read error on mount')
    const spy = vi.spyOn(activeFocusSession, 'getActiveFocusSessionWithGeneration').mockRejectedValueOnce(readError)

    const { result } = renderHook(() => useFocusSession({ subjectMap }))

    await waitFor(() => expect(result.current.sessionNotice).toBe('Active focus session could not be loaded due to a storage error.'))
    expect(result.current.canStartFocus).toBe(false)
    expect(result.current.activeSession).toBeNull()

    // Subsequent reload after recovery restores readiness and clears notice
    spy.mockRestore()
    await act(async () => {
      await result.current.reloadFocusFromIndexedDb()
    })

    expect(result.current.canStartFocus).toBe(true)
    expect(result.current.sessionNotice).toBe('')
  })

  it('preserves deferred auto-completion retry state when getActiveFocusSession rejects transiently', async () => {
    const { DataOperationCoordinator } = await import('../db/dataCoordinator')
    const coordinator = new DataOperationCoordinator()

    // Create session started 30 mins ago with 25 min duration (already elapsed)
    const elapsedSession = makeSession({
      id: 'focus-timed-retry',
      plannedMinutes: 25,
      startedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    })
    await createActiveFocusSession(elapsedSession, { expectedGeneration: 1 })

    // Simulate transient failure on getActiveFocusSession during timed completion read
    let callCount = 0
    const getSpy = vi.spyOn(activeFocusSession, 'getActiveFocusSession').mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        throw new Error('Transient read failure')
      }
      return elapsedSession
    })

    const { result } = renderHook(() => useFocusSession({ subjectMap, coordinator }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-timed-retry'))

    // Trigger coordinator event to evaluate timed completion
    await act(async () => {
      // Run a focus write to fire coordinator listeners and evaluate completion
      await coordinator.runFocusWrite(async () => {})
    })

    // After transient failure and recovery retry, session is finalized
    await waitFor(async () => {
      expect(await studyDb.studySessions.count()).toBe(1)
    }, { timeout: 2000 })

    getSpy.mockRestore()
  })

  it('records ten active minutes when stopped after five minutes paused', async () => {
    let monotonicNow = 0
    vi.spyOn(performance, 'now').mockImplementation(() => monotonicNow)
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.canStartFocus).toBe(true))
    await act(async () => { await result.current.startSession() })
    const id = result.current.activeSession!.id
    monotonicNow = 10 * 60_000
    await act(async () => { await result.current.pauseSession() })
    monotonicNow += 5 * 60_000
    await act(async () => { await result.current.stopSession() })
    expect((await studyDb.studySessions.get(id))?.minutes).toBe(10)
    await act(async () => { await result.current.stopSession() })
    expect(await studyDb.studySessions.count()).toBe(1)
  })

  it('keeps a paused subject change at ten minutes and counts only resumed active intervals', async () => {
    let monotonicNow = 0
    vi.spyOn(performance, 'now').mockImplementation(() => monotonicNow)
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.canStartFocus).toBe(true))
    await act(async () => { await result.current.startSession() })
    const id = result.current.activeSession!.id
    monotonicNow = 600_000
    await act(async () => { await result.current.pauseSession() })
    monotonicNow += 300_000
    act(() => result.current.updateFocusSubject('subject-b'))
    await waitFor(async () => expect((await getActiveFocusSession())?.subjectId).toBe('subject-b'))
    expect((await getActiveFocusSession())?.checkpointElapsedMs).toBe(600_000)
    expect(result.current.elapsedSeconds).toBe(600)
    await act(async () => { await result.current.resumeSession() })
    monotonicNow += 120_000
    await act(async () => { await result.current.pauseSession() })
    monotonicNow += 300_000
    await act(async () => { await result.current.resumeSession() })
    monotonicNow += 60_000
    await act(async () => { await result.current.stopSession() })
    expect((await studyDb.studySessions.get(id))?.minutes).toBe(13)
  })

  it.each(['paused', 'running'] as const)('restores authoritative %s checkpoints without inventing inactive time', async (status) => {
    let monotonicNow = 0
    vi.spyOn(performance, 'now').mockImplementation(() => monotonicNow)
    const session = makeSession({
      plannedMinutes: 0, status, checkpointElapsedMs: 600_000,
      pausedAt: status === 'paused' ? new Date().toISOString() : null,
    })
    await createActiveFocusSession(session, { expectedGeneration: 1 })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe(session.id))
    expect(result.current.elapsedSeconds).toBe(600)
    monotonicNow += 300_000
    await act(async () => { await result.current.stopSession() })
    expect((await studyDb.studySessions.get(session.id))?.minutes).toBe(status === 'paused' ? 10 : 15)
  })

  it.each(['missing', 'conflict', 'invalid_state'] as const)('reconciles periodic checkpoint %s outcomes and freezes obsolete elapsed', async (reason) => {
    const checkpointSpy = vi.spyOn(activeFocusSession, 'checkpointActiveFocusSession')
    let monotonicNow = 0
    vi.spyOn(performance, 'now').mockImplementation(() => monotonicNow)
    const session = makeSession({ plannedMinutes: 0, checkpointElapsedMs: 600_000 })
    await createActiveFocusSession(session, { expectedGeneration: 1 })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await vi.waitFor(() => expect(result.current.activeSession?.id).toBe(session.id))
    const durable = makeSession({
      id: reason === 'conflict' ? 'focus-replacement' : session.id,
      status: 'paused', pausedAt: new Date().toISOString(), checkpointElapsedMs: 600_000,
    })
    if (reason === 'missing') await studyDb.settings.delete(activeFocusSession.ACTIVE_FOCUS_SESSION_KEY)
    else await studyDb.settings.put({ key: activeFocusSession.ACTIVE_FOCUS_SESSION_KEY, value: durable })
    monotonicNow += 30_000
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(checkpointSpy).toHaveBeenCalledTimes(1)
    await act(async () => { await checkpointSpy.mock.results[0].value })
    expect(result.current.activeSession).toEqual(reason === 'missing' ? null : durable)
    monotonicNow += 300_000
    await act(async () => { await vi.advanceTimersByTimeAsync(300_000) })
    expect(result.current.elapsedSeconds).toBe(reason === 'missing' ? 0 : 600)
    vi.useRealTimers()
  })

  it('reconciles a Resume committed elsewhere while this tab is paused', async () => {
    const paused = makeSession({ plannedMinutes: 0, status: 'paused', pausedAt: new Date().toISOString(), checkpointElapsedMs: 600_000 })
    await createActiveFocusSession(paused, { expectedGeneration: 1 })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await vi.waitFor(() => expect(result.current.activeSession?.status).toBe('paused'))
    const resumed = await activeFocusSession.resumeActiveFocusSession(paused.id, { expectedGeneration: 1 })
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(result.current.activeSession).toEqual(resumed.ok ? resumed.session : undefined)
    expect(result.current.elapsedSeconds).toBe(600)
    vi.useRealTimers()
  })

  it('reports checkpoint storage errors without discarding recoverable focus ownership', async () => {
    await createActiveFocusSession(makeSession({ plannedMinutes: 0 }), { expectedGeneration: 1 })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await vi.waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))
    vi.spyOn(activeFocusSession, 'checkpointActiveFocusSession').mockRejectedValue(new Error('storage unavailable'))
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(result.current.sessionNotice).toBe('Could not save focus progress. Try again.')
    expect(result.current.activeSession?.id).toBe('focus-hook')
    vi.useRealTimers()
  })

  it('does not reinstall an old checkpoint response after a newer Pause settles', async () => {
    const session = makeSession({ plannedMinutes: 0, checkpointElapsedMs: 600_000 })
    await createActiveFocusSession(session, { expectedGeneration: 1 })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await vi.waitFor(() => expect(result.current.activeSession?.id).toBe(session.id))
    let release!: (value: activeFocusSession.CheckpointActiveFocusSessionResult) => void
    const gate = new Promise<activeFocusSession.CheckpointActiveFocusSessionResult>((resolve) => { release = resolve })
    vi.spyOn(activeFocusSession, 'checkpointActiveFocusSession').mockReturnValueOnce(gate)
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    await act(async () => { await result.current.pauseSession() })
    const paused = await getActiveFocusSession()
    await act(async () => { release({ ok: true, session }); await gate })
    expect(result.current.activeSession).toEqual(paused)
    expect(result.current.activeSession?.status).toBe('paused')
    vi.useRealTimers()
  })

  it('does not reinstall an old subject response after a newer Pause settles', async () => {
    const session = makeSession({ plannedMinutes: 0, checkpointElapsedMs: 600_000 })
    await createActiveFocusSession(session, { expectedGeneration: 1 })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe(session.id))
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const realUpdate = activeFocusSession.updateActiveFocusSessionSubject
    const updateSpy = vi.spyOn(activeFocusSession, 'updateActiveFocusSessionSubject').mockImplementationOnce(async (...args) => {
      const response = await realUpdate(...args)
      await gate
      return response
    })
    act(() => result.current.updateFocusSubject('subject-b'))
    await waitFor(async () => expect((await getActiveFocusSession())?.subjectId).toBe('subject-b'))
    await act(async () => { await result.current.pauseSession() })
    const paused = await getActiveFocusSession()
    await act(async () => { release(); await updateSpy.mock.results[0].value })
    expect(result.current.activeSession).toEqual(paused)
    expect(result.current.activeSession?.status).toBe('paused')
  })

  it('lets an external Pause committed after the UI eligibility read prevent automatic finalization', async () => {
    const session = makeSession({ checkpointElapsedMs: 25 * 60_000 })
    await createActiveFocusSession(session, { expectedGeneration: 1 })
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const realFinalize = activeFocusSession.finalizeActiveFocusSession
    const finalizeSpy = vi.spyOn(activeFocusSession, 'finalizeActiveFocusSession').mockImplementationOnce(async (...args) => {
      await gate
      return realFinalize(...args)
    })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(finalizeSpy).toHaveBeenCalledTimes(1))
    const paused = await activeFocusSession.pauseActiveFocusSession(session.id, { expectedGeneration: 1 })
    await act(async () => { release(); await finalizeSpy.mock.results[0].value })
    expect(await studyDb.studySessions.count()).toBe(0)
    expect(result.current.activeSession).toEqual(paused.ok ? paused.session : undefined)
    expect(result.current.activeSession?.status).toBe('paused')
  })

  it('R-001 reconciles obsolete Pause after an external Pause/Resume without earning paused time', async () => {
    let mono = 0
    vi.spyOn(performance, 'now').mockImplementation(() => mono)
    const session = makeSession({ plannedMinutes: 0, checkpointElapsedMs: 0 })
    await createActiveFocusSession(session, { expectedGeneration: 1 })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe(session.id))
    mono = 600_000
    await activeFocusSession.pauseActiveFocusSession(session.id, { logicalElapsedMs: mono, observed: session, pausedAt: new Date(Date.parse(session.startedAt) + mono).toISOString() }, { expectedGeneration: 1 })
    mono = 900_000
    await activeFocusSession.resumeActiveFocusSession(session.id, Date.parse(session.startedAt) + mono, { expectedGeneration: 1 })
    await act(async () => { await result.current.pauseSession() })
    expect(result.current.activeSession?.status).toBe('running')
    expect(result.current.sessionNotice).toBe('Focus session was updated elsewhere.')
    expect((await getActiveFocusSession())?.checkpointElapsedMs).toBe(600_000)
    await act(async () => { await result.current.stopSession() })
    expect((await studyDb.studySessions.get(session.id))?.minutes).toBe(10)
  })

  it('R-002 retains five further active minutes across a delayed subject acknowledgement', async () => {
    let mono = 0
    vi.spyOn(performance, 'now').mockImplementation(() => mono)
    await createActiveFocusSession(makeSession({ plannedMinutes: 0, checkpointElapsedMs: 0 }), { expectedGeneration: 1 })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const real = activeFocusSession.updateActiveFocusSessionSubject
    const update = vi.spyOn(activeFocusSession, 'updateActiveFocusSessionSubject').mockImplementationOnce(async (...args) => {
      const response = await real(...args)
      await gate
      return response
    })
    mono = 600_000
    act(() => result.current.updateFocusSubject('subject-b'))
    await waitFor(async () => expect((await getActiveFocusSession())?.subjectId).toBe('subject-b'))
    mono = 900_000
    await act(async () => { release(); await update.mock.results[0].value })
    expect(result.current.elapsedSeconds).toBe(900)
    await act(async () => { await result.current.stopSession() })
    expect(await studyDb.studySessions.get('focus-hook')).toMatchObject({ minutes: 15, subjectId: 'subject-b' })
  })

  it('retains active time and failure feedback when a delayed subject write fails in the same interval', async () => {
    let mono = 0
    vi.spyOn(performance, 'now').mockImplementation(() => mono)
    await createActiveFocusSession(makeSession({ plannedMinutes: 0, checkpointElapsedMs: 0 }), { expectedGeneration: 1 })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const update = vi.spyOn(activeFocusSession, 'updateActiveFocusSessionSubject').mockImplementationOnce(async () => {
      await gate
      throw new Error('storage failure')
    })
    mono = 600_000
    act(() => result.current.updateFocusSubject('subject-b'))
    mono = 900_000
    await act(async () => { release(); await update.mock.results[0].value.catch(() => undefined) })
    await waitFor(() => expect(result.current.sessionNotice).toBe('Could not update the focus subject. Try again.'))
    expect(result.current.elapsedSeconds).toBe(900)
    expect(result.current.activeSession?.subjectId).toBe('subject-a')
    expect(result.current.sessionNotice).toBe('Could not update the focus subject. Try again.')
    await act(async () => { await result.current.stopSession() })
    expect(await studyDb.studySessions.get('focus-hook')).toMatchObject({ minutes: 15, subjectId: 'subject-a' })
  })

  it('retains current elapsed and latest durable subject when acknowledgements settle out of order', async () => {
    let mono = 0
    vi.spyOn(performance, 'now').mockImplementation(() => mono)
    const session = makeSession({ plannedMinutes: 0, checkpointElapsedMs: 0 })
    await createActiveFocusSession(session, { expectedGeneration: 1 })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe(session.id))
    const releases: Array<() => void> = []
    const real = activeFocusSession.updateActiveFocusSessionSubject
    const update = vi.spyOn(activeFocusSession, 'updateActiveFocusSessionSubject').mockImplementation(async (...args) => {
      const response = await real(...args)
      await new Promise<void>((resolve) => { releases.push(resolve) })
      return response
    })
    mono = 600_000
    act(() => result.current.updateFocusSubject('subject-b'))
    await waitFor(() => expect(releases).toHaveLength(1))
    mono = 660_000
    act(() => result.current.updateFocusSubject('subject-c'))
    await waitFor(() => expect(releases).toHaveLength(2))
    mono = 900_000
    await act(async () => { releases[1](); await update.mock.results[1].value })
    expect(result.current.elapsedSeconds).toBe(900)
    await act(async () => { releases[0](); await update.mock.results[0].value })
    expect(result.current.elapsedSeconds).toBe(900)
    expect(result.current.activeSession?.subjectId).toBe('subject-c')
    expect((await getActiveFocusSession())?.subjectId).toBe('subject-c')
    await act(async () => { await result.current.stopSession() })
    expect(await studyDb.studySessions.get(session.id)).toMatchObject({ minutes: 15, subjectId: 'subject-c' })
  })

  it.each(['pause', 'replacement', 'removal', 'finalization'] as const)('R-003 rejects delayed subject acknowledgement after checkpoint reconciles %s', async (change) => {
    const session = makeSession({ plannedMinutes: 0, checkpointElapsedMs: 600_000 })
    await createActiveFocusSession(session, { expectedGeneration: 1 })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await vi.waitFor(() => expect(result.current.activeSession?.id).toBe(session.id))
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const real = activeFocusSession.updateActiveFocusSessionSubject
    const update = vi.spyOn(activeFocusSession, 'updateActiveFocusSessionSubject').mockImplementationOnce(async (...args) => {
      const response = await real(...args)
      await gate
      return response
    })
    act(() => result.current.updateFocusSubject('subject-b'))
    await act(async () => { await vi.waitFor(async () => expect((await getActiveFocusSession())?.subjectId).toBe('subject-b')) })
    if (change === 'pause') await activeFocusSession.pauseActiveFocusSession(session.id, { expectedGeneration: 1 })
    else if (change === 'finalization') {
      expect(await activeFocusSession.finalizeActiveFocusSession(session.id, {
        subjectId: 'subject-b', startedAt: session.startedAt, endedAt: new Date().toISOString(), minutes: 10, note: 'Focus session',
      }, { expectedGeneration: 1 }, { mode: 'manual', observed: session })).toMatchObject({ ok: true })
    } else {
      await activeFocusSession.discardActiveFocusSession(session.id, { expectedGeneration: 1 })
      if (change === 'replacement') await createActiveFocusSession(makeSession({ id: 'focus-new', plannedMinutes: 0, status: 'paused', pausedAt: new Date().toISOString(), checkpointElapsedMs: 120_000 }), { expectedGeneration: 1 })
    }
    const checkpoint = vi.spyOn(activeFocusSession, 'checkpointActiveFocusSession')
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(checkpoint).toHaveBeenCalledTimes(1)
    await act(async () => { await checkpoint.mock.results[0].value })
    const authoritative = await getActiveFocusSession()
    const notice = result.current.sessionNotice
    expect(result.current.activeSession).toEqual(authoritative)
    await act(async () => { release(); await update.mock.results[0].value })
    expect(result.current.activeSession).toEqual(authoritative)
    expect(result.current.sessionNotice).toBe(notice)
    const frozen = result.current.elapsedSeconds
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
    expect(result.current.elapsedSeconds).toBe(frozen)
    vi.useRealTimers()
  })

  describe('IR-001 collision anchor provenance', () => {
    async function seedCollision(overrides: Partial<ActiveFocusSession> = {}) {
      const session = makeSession({ startedAt: new Date().toISOString(), plannedMinutes: 0, checkpointElapsedMs: 0, ...overrides })
      const foreign = { id: session.id, subjectId: 'subject-a', startedAt: session.startedAt, endedAt: session.startedAt, minutes: 1, note: 'Foreign history' }
      await studyDb.studySessions.add(foreign)
      await studyDb.settings.put({ key: activeFocusSession.ACTIVE_FOCUS_SESSION_KEY, value: session })
      return { session, foreign }
    }

    it.each([false, true])('reconciles stale elapsed after external Pause/Resume (rollback=%s)', async (rollback) => {
      let mono = 0
      const wall = Date.now()
      vi.spyOn(performance, 'now').mockImplementation(() => mono)
      vi.spyOn(Date, 'now').mockImplementation(() => wall + (rollback ? 0 : mono))
      const { session, foreign } = await seedCollision()
      const { result } = renderHook(() => useFocusSession({ subjectMap }))
      await waitFor(() => expect(result.current.activeSession?.id).toBe(session.id))
      mono = 600_000
      const paused = await activeFocusSession.pauseActiveFocusSession(session.id, { logicalElapsedMs: mono, observed: session, pausedAt: new Date(wall + (rollback ? 0 : mono)).toISOString() }, { expectedGeneration: 1 })
      expect(paused.ok).toBe(true)
      mono = 900_000
      const resumed = await activeFocusSession.resumeActiveFocusSession(session.id, wall + (rollback ? -60_000 : mono), { expectedGeneration: 1 })
      expect(resumed.ok && resumed.session.runToken).toBeTruthy()
      await act(async () => { await result.current.stopSession() })
      // A changed interval is a reconciliation boundary, not permission to
      // finalize unobservable progress. The user's explicit retry uses a new anchor.
      expect(result.current.activeSession?.id).not.toBe(session.id)
      expect(result.current.elapsedSeconds).toBe(600)
      expect(result.current.sessionNotice).toBe('Focus session was updated elsewhere. Review it and stop again.')
      expect(await studyDb.studySessions.toArray()).toEqual([foreign])
      await act(async () => { await result.current.stopSession() })
      expect(await getActiveFocusSession()).toBeNull()
      const history = await studyDb.studySessions.toArray()
      expect(history).toHaveLength(2)
      expect(history.find((row) => row.id === foreign.id)).toEqual(foreign)
      expect(history.find((row) => row.id !== foreign.id)?.minutes).toBe(10)
    })

    it.each(['running', 'paused'] as const)('preserves earned duration across a same-interval %s rekey', async (status) => {
      let mono = 0
      vi.spyOn(performance, 'now').mockImplementation(() => mono)
      const { session, foreign } = await seedCollision({ status, pausedAt: status === 'paused' ? new Date().toISOString() : null, checkpointElapsedMs: 600_000 })
      const { result } = renderHook(() => useFocusSession({ subjectMap }))
      await waitFor(() => expect(result.current.activeSession?.id).toBe(session.id))
      mono = 300_000
      await act(async () => { await result.current.stopSession() })
      expect(await getActiveFocusSession()).toBeNull()
      expect(result.current.activeSession).toBeNull()
      expect(await studyDb.studySessions.get(foreign.id)).toEqual(foreign)
      const history = await studyDb.studySessions.toArray()
      expect(history).toHaveLength(2)
      expect(history.find((row) => row.id !== foreign.id)?.minutes).toBe(status === 'running' ? 15 : 10)
    })

    it('preserves thirty confirmed minutes despite a stale observation and a twenty-five minute plan', async () => {
      vi.spyOn(performance, 'now').mockReturnValue(0)
      const { session, foreign } = await seedCollision({ status: 'paused', pausedAt: new Date().toISOString(), plannedMinutes: 25, checkpointElapsedMs: 1_800_000 })
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const { result } = renderHook(() => useFocusSession({ subjectMap }))
      await vi.waitFor(() => expect(result.current.activeSession?.id).toBe(session.id))
      await activeFocusSession.resumeActiveFocusSession(session.id, { expectedGeneration: 1 })
      await act(async () => { await result.current.stopSession() })
      expect(result.current.elapsedSeconds).toBe(1800)
      // Pause the reconciled session to prevent scheduled planned completion;
      // manual Stop must retain overtime rather than apply the automatic contract.
      await act(async () => { await result.current.pauseSession() })
      await act(async () => { await result.current.stopSession() })
      const history = await studyDb.studySessions.toArray()
      expect(history).toHaveLength(2)
      expect(history.find((row) => row.id !== foreign.id)?.minutes).toBe(30)
      expect(await studyDb.studySessions.get(foreign.id)).toEqual(foreign)
      expect(await getActiveFocusSession()).toBeNull()
      vi.useRealTimers()
    })

    it.each(['same', 'transition', 'replacement', 'clear', 'replacement-unseen', 'clear-unseen', 'removed', 'finalized'] as const)('handles a delayed collision response with %s ownership', async (change) => {
      let mono = 0
      vi.spyOn(performance, 'now').mockImplementation(() => mono)
      const { session, foreign } = await seedCollision({ checkpointElapsedMs: 600_000 })
      const { result } = renderHook(() => useFocusSession({ subjectMap }))
      await waitFor(() => expect(result.current.activeSession?.id).toBe(session.id))
      let release!: () => void
      const gate = new Promise<void>((resolve) => { release = resolve })
      const realFinalize = activeFocusSession.finalizeActiveFocusSession
      const finalize = vi.spyOn(activeFocusSession, 'finalizeActiveFocusSession').mockImplementationOnce(async (...args) => {
        const response = await realFinalize(...args)
        await gate
        return response
      })
      let stop!: Promise<void>
      act(() => { stop = result.current.stopSession() })
      await waitFor(async () => expect((await getActiveFocusSession())?.id).not.toBe(session.id))
      const rekeyed = (await getActiveFocusSession())!
      mono = 300_000
      if (change === 'transition') {
        await activeFocusSession.pauseActiveFocusSession(rekeyed.id, { logicalElapsedMs: 600_000, observed: rekeyed }, { expectedGeneration: 1 })
        await activeFocusSession.resumeActiveFocusSession(rekeyed.id, { expectedGeneration: 1 })
      } else if (change.startsWith('replacement') || change.startsWith('clear')) {
        await clearAllStudyData()
        if (change.startsWith('replacement')) await createActiveFocusSession(makeSession({ id: 'replacement', subjectId: '', plannedMinutes: 0, checkpointElapsedMs: 120_000 }), { expectedGeneration: await getDatabaseGeneration(studyDb.settings) })
        if (!change.endsWith('unseen')) await act(async () => { await result.current.reloadFocusFromIndexedDb() })
      } else if (change === 'removed') {
        await activeFocusSession.discardActiveFocusSession(rekeyed.id, { expectedGeneration: 1 })
      } else if (change === 'finalized') {
        expect(await realFinalize(rekeyed.id, { subjectId: rekeyed.subjectId, startedAt: rekeyed.startedAt, endedAt: rekeyed.startedAt, minutes: 10, note: 'Other tab' }, { expectedGeneration: 1 }, { mode: 'manual', observed: rekeyed })).toMatchObject({ ok: true })
      }
      await act(async () => { release(); await stop })
      if (change === 'same') {
        expect(await getActiveFocusSession()).toBeNull()
        expect(await studyDb.studySessions.get(foreign.id)).toEqual(foreign)
        const history = await studyDb.studySessions.toArray()
        expect(history).toHaveLength(2)
        expect(history.find((row) => row.id !== foreign.id)?.minutes).toBe(15)
        expect(finalize).toHaveBeenCalledTimes(2)
      } else if (change === 'transition') {
        expect(result.current.activeSession).toEqual(await getActiveFocusSession())
        expect(result.current.elapsedSeconds).toBe(600)
        expect(await studyDb.studySessions.toArray()).toEqual([foreign])
        expect(finalize).toHaveBeenCalledTimes(1)
      } else if (change === 'replacement' || change === 'clear') {
        expect(result.current.activeSession).toEqual(await getActiveFocusSession())
        expect(result.current.activeSession?.id).toBe(change === 'replacement' ? 'replacement' : undefined)
        expect(await studyDb.studySessions.count()).toBe(0)
        expect(finalize).toHaveBeenCalledTimes(1)
      } else {
        expect(result.current.activeSession).toBeNull()
        expect(finalize).toHaveBeenCalledTimes(1)
        if (change === 'replacement-unseen' || change === 'clear-unseen') {
          expect((await getActiveFocusSession())?.id).toBe(change === 'replacement-unseen' ? 'replacement' : undefined)
          expect(result.current.sessionNotice).toBe('The database was updated elsewhere. Study time was not logged.')
          expect(await studyDb.studySessions.count()).toBe(0)
        } else {
          expect(await getActiveFocusSession()).toBeNull()
          expect(await studyDb.studySessions.get(foreign.id)).toEqual(foreign)
          expect(await studyDb.studySessions.count()).toBe(change === 'finalized' ? 2 : 1)
        }
      }
    })

    it('holds the duplicate Stop guard through the rekey retry', async () => {
      vi.spyOn(performance, 'now').mockReturnValue(0)
      const { session, foreign } = await seedCollision({ checkpointElapsedMs: 600_000 })
      const { result } = renderHook(() => useFocusSession({ subjectMap }))
      await waitFor(() => expect(result.current.activeSession?.id).toBe(session.id))
      let release!: () => void
      const gate = new Promise<void>((resolve) => { release = resolve })
      const real = activeFocusSession.finalizeActiveFocusSession
      const finalize = vi.spyOn(activeFocusSession, 'finalizeActiveFocusSession')
        .mockImplementationOnce(real)
        .mockImplementationOnce(async (...args) => { await gate; return real(...args) })
      const staleStop = result.current.stopSession
      let stop!: Promise<void>
      act(() => { stop = result.current.stopSession() })
      await waitFor(() => expect(finalize).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(result.current.activeSession?.id).not.toBe(session.id))
      await act(async () => { await staleStop(); await result.current.stopSession(); await result.current.stopSession(true) })
      expect(finalize).toHaveBeenCalledTimes(2)
      await act(async () => { release(); await stop })
      expect(result.current.activeSession).toBeNull()
      expect(await getActiveFocusSession()).toBeNull()
      const history = await studyDb.studySessions.toArray()
      expect(history).toHaveLength(2)
      expect(history.find((row) => row.id === foreign.id)).toEqual(foreign)
      expect(history.find((row) => row.id !== foreign.id)?.minutes).toBe(10)
    })

    it.each(['transition', 'generation'] as const)('rejects %s changes at the final retry transaction boundary', async (change) => {
      let mono = 0
      vi.spyOn(performance, 'now').mockImplementation(() => mono)
      const { session, foreign } = await seedCollision({ checkpointElapsedMs: 600_000 })
      const { result } = renderHook(() => useFocusSession({ subjectMap }))
      await waitFor(() => expect(result.current.activeSession?.id).toBe(session.id))
      let release!: () => void
      const gate = new Promise<void>((resolve) => { release = resolve })
      const real = activeFocusSession.finalizeActiveFocusSession
      const finalize = vi.spyOn(activeFocusSession, 'finalizeActiveFocusSession')
        .mockImplementationOnce(real)
        .mockImplementationOnce(async (...args) => { await gate; return real(...args) })
      let stop!: Promise<void>
      act(() => { stop = result.current.stopSession() })
      await waitFor(() => expect(finalize).toHaveBeenCalledTimes(2))
      const rekeyed = (await getActiveFocusSession())!
      mono = 300_000
      if (change === 'transition') {
        await activeFocusSession.pauseActiveFocusSession(rekeyed.id, { logicalElapsedMs: 600_000, observed: rekeyed }, { expectedGeneration: 1 })
        await activeFocusSession.resumeActiveFocusSession(rekeyed.id, { expectedGeneration: 1 })
      } else {
        await clearAllStudyData()
        await createActiveFocusSession(makeSession({ id: 'replacement', subjectId: '', plannedMinutes: 0, checkpointElapsedMs: 120_000 }), { expectedGeneration: await getDatabaseGeneration(studyDb.settings) })
      }
      await act(async () => { release(); await stop })
      if (change === 'transition') {
        expect(result.current.activeSession).toEqual(await getActiveFocusSession())
        expect(result.current.elapsedSeconds).toBe(600)
        expect(await studyDb.studySessions.toArray()).toEqual([foreign])
      } else {
        expect(result.current.activeSession).toBeNull()
        expect((await getActiveFocusSession())?.id).toBe('replacement')
        expect(await studyDb.studySessions.count()).toBe(0)
      }
    })
  })

  describe('F-11 live monotonic clock and rollback safety in useFocusSession', () => {
    it('tracks elapsedSeconds and remainingSeconds from active study', async () => {
      const session = makeSession({
        id: 'focus-monotonic-1',
        startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
        plannedMinutes: 25,
      })
      await createActiveFocusSession(session, { expectedGeneration: 1 })

      const { result } = renderHook(() => useFocusSession({ subjectMap }))
      await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-monotonic-1'))
      expect(result.current.elapsedSeconds).toBeGreaterThanOrEqual(300)
      expect(result.current.remainingSeconds).toBeLessThanOrEqual(25 * 60 - 300)
    })

    it('pausing during wall-clock rollback durably commits logical elapsed time', async () => {
      const startedAt = new Date(Date.now() - 10 * 60_000).toISOString()
      const session = makeSession({
        id: 'focus-pause-rollback',
        startedAt,
        plannedMinutes: 25,
      })
      await createActiveFocusSession(session, { expectedGeneration: 1 })

      const { result } = renderHook(() => useFocusSession({ subjectMap }))
      await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-pause-rollback'))
      expect(result.current.elapsedSeconds).toBeGreaterThanOrEqual(600)

      // Simulate clock rollback: Date.now() returns time before startedAt
      const rollbackNow = Date.parse(startedAt) - 30 * 60_000
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(rollbackNow)

      // Click pause
      await act(async () => {
        await result.current.pauseSession()
      })

      expect(result.current.activeSession?.status).toBe('paused')
      expect(result.current.activeSession?.checkpointElapsedMs).toBeGreaterThanOrEqual(600_000)
      const durable = await getActiveFocusSession()
      expect(durable?.status).toBe('paused')
      expect(durable?.checkpointElapsedMs).toBeGreaterThanOrEqual(600_000)
      expect(Date.parse(durable!.pausedAt!)).toBeGreaterThanOrEqual(Date.parse(startedAt))

      dateSpy.mockRestore()
    })

    it('resuming and finalizing under rollback preserves study time and passes domain assertions', async () => {
      const startedAt = new Date(Date.now() - 15 * 60_000).toISOString()
      const session = makeSession({
        id: 'focus-res-fin-rollback',
        startedAt,
        plannedMinutes: 25,
        status: 'paused',
        pausedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
        checkpointElapsedMs: 10 * 60_000,
      })
      await createActiveFocusSession(session, { expectedGeneration: 1 })

      // System clock is in the past (before startedAt)
      const rollbackNow = Date.parse(startedAt) - 10 * 60_000
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(rollbackNow)

      const { result } = renderHook(() => useFocusSession({ subjectMap }))
      await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-res-fin-rollback'))
      expect(result.current.elapsedSeconds).toBe(10 * 60)

      // Resume under rollback
      await act(async () => {
        await result.current.resumeSession()
      })
      expect(result.current.activeSession?.status).toBe('running')

      // Stop session
      await act(async () => {
        await result.current.stopSession(false)
      })

      // Must log at least 10 minutes of study history without throwing assertion
      const history = await studyDb.studySessions.get('focus-res-fin-rollback')
      expect(history).toBeDefined()
      expect(history?.minutes).toBeGreaterThanOrEqual(10)
      expect(Date.parse(history!.endedAt)).toBeGreaterThanOrEqual(Date.parse(startedAt))
      expect(result.current.activeSession).toBeNull()

      dateSpy.mockRestore()
    })

    it('reloads after a forward clock jump restoring the durable checkpoint rather than wall-jumped time', async () => {
      // Session with durable 30m checkpoint
      const session = makeSession({
        id: 'focus-fwd-jump',
        startedAt: '2026-07-20T10:00:00.000Z',
        plannedMinutes: 60,
        checkpointElapsedMs: 30 * 60_000,
      })
      await createActiveFocusSession(session, { expectedGeneration: 1 })

      // 6. Wall clock jumps forward to 10:45 (+15m forward jump)
      const forwardNow = Date.parse('2026-07-20T10:45:00.000Z')
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(forwardNow)

      const { result } = renderHook(() => useFocusSession({ subjectMap }))
      await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-fwd-jump'))

      // Reload restores base elapsed at exactly 30m (1800s), NOT 45m (2700s)
      expect(result.current.elapsedSeconds).toBe(30 * 60)

      dateSpy.mockRestore()
    })

    it('restores updated durable checkpoint after a periodic or explicit checkpoint', async () => {
      const session = makeSession({
        id: 'focus-checkpoint-restore',
        startedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
        plannedMinutes: 60,
        checkpointElapsedMs: 30 * 60_000,
      })
      await createActiveFocusSession(session, { expectedGeneration: 1 })

      // Advance checkpoint to 35m
      await activeFocusSession.checkpointActiveFocusSession('focus-checkpoint-restore', 35 * 60_000, { expectedGeneration: 1 })

      // 7. After real checkpoint of 35m, reload restores 35m
      const { result } = renderHook(() => useFocusSession({ subjectMap }))
      await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-checkpoint-restore'))
      expect(result.current.elapsedSeconds).toBe(35 * 60)
    })

    it('subject update and pause carry live earned elapsed into durable checkpoints', async () => {
      const session = makeSession({
        id: 'focus-subject-earned',
        startedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
        plannedMinutes: 60,
        checkpointElapsedMs: 10 * 60_000,
      })
      await createActiveFocusSession(session, { expectedGeneration: 1 })

      const { result } = renderHook(() => useFocusSession({ subjectMap }))
      await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-subject-earned'))

      // 12. Update subject: preserves and checkpoints live elapsed
      await act(async () => {
        result.current.updateFocusSubject('subject-b')
      })
      expect(result.current.focusSubjectId).toBe('subject-b')
      const durableAfterSubject = await getActiveFocusSession()
      expect(durableAfterSubject?.subjectId).toBe('subject-b')
      expect(durableAfterSubject?.checkpointElapsedMs).toBeGreaterThanOrEqual(10 * 60_000)

      // Pause: durably commits live elapsed
      await act(async () => {
        await result.current.pauseSession()
      })
      const durableAfterPause = await getActiveFocusSession()
      expect(durableAfterPause?.status).toBe('paused')
      expect(durableAfterPause?.checkpointElapsedMs).toBeGreaterThanOrEqual(10 * 60_000)
    })

    it('F-12: startSession automatically retries with fresh ID when candidate ID collides with existing studySessions', async () => {
      // Seed existing historical study session
      const existingHistory: StudySession = {
        id: 'focus-colliding-candidate',
        subjectId: 'subject-a',
        startedAt: '2026-07-15T10:00:00.000Z',
        endedAt: '2026-07-15T10:30:00.000Z',
        minutes: 30,
        note: 'Prior session',
      }
      await studyDb.studySessions.add(existingHistory)

      // Mock createId to return colliding ID on 1st call, then fresh unique ID on 2nd call
      const originalCreateId = studyDbModule.createId
      let callCount = 0
      const createIdSpy = vi.spyOn(studyDbModule, 'createId').mockImplementation((prefix) => {
        callCount++
        if (callCount === 1) return 'focus-colliding-candidate'
        return originalCreateId(prefix)
      })

      const { result } = renderHook(() => useFocusSession({ subjectMap }))
      await waitFor(() => expect(result.current.canStartFocus).toBe(true))

      await act(async () => {
        await result.current.startSession()
      })

      expect(result.current.activeSession).not.toBeNull()
      expect(result.current.activeSession?.id).not.toBe('focus-colliding-candidate')
      expect(await getActiveFocusSession()).not.toBeNull()

      createIdSpy.mockRestore()
    })

    it('F-12: stopSession automatically adopts re-keyed ID and finalizes when collision occurs', async () => {
      // 1. Seed existing historical study session
      const existingHistory: StudySession = {
        id: 'focus-legacy-collision',
        subjectId: 'subject-a',
        startedAt: '2026-07-15T10:00:00.000Z',
        endedAt: '2026-07-15T10:30:00.000Z',
        minutes: 30,
        note: 'Prior session',
      }
      await studyDb.studySessions.add(existingHistory)

      // 2. Seed active focus session with colliding ID (e.g. from imported backup)
      const activeSession: ActiveFocusSession = {
        id: 'focus-legacy-collision',
        subjectId: 'subject-a',
        startedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
        plannedMinutes: 25,
        status: 'running',
        pausedAt: null,
        accumulatedPausedMs: 0,
        checkpointElapsedMs: 2 * 60_000,
      }
      await studyDb.settings.put({
        key: 'activeFocusSession',
        value: activeSession,
      })

      const { result } = renderHook(() => useFocusSession({ subjectMap }))
      await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-legacy-collision'))

      await act(async () => {
        await result.current.stopSession()
      })

      // Active session cleared from local and durable state
      expect(result.current.activeSession).toBeNull()
      expect(await getActiveFocusSession()).toBeNull()

      // StudySessions has 2 rows: original untouched + newly created canonical row
      expect(await studyDb.studySessions.count()).toBe(2)
      const allSessions = await studyDb.studySessions.toArray()
      const newSession = allSessions.find((s) => s.id !== 'focus-legacy-collision')
      expect(newSession).toBeDefined()
      expect(newSession?.subjectId).toBe('subject-a')
      expect(newSession?.minutes).toBe(2)
    })

    it('derives canEnterZen and canEnterZenReason across idle, running, paused, and stale states', async () => {
      const { result } = renderHook(() => useFocusSession({ subjectMap }))
      await waitFor(() => expect(result.current.canStartFocus).toBe(true))

      // Idle: no session
      expect(result.current.canEnterZen).toBe(false)
      expect(result.current.canEnterZenReason).toBe('no-session')

      // Start session -> running: available
      await act(async () => {
        await result.current.startSession()
      })
      expect(result.current.activeSession?.status).toBe('running')
      expect(result.current.canEnterZen).toBe(true)
      expect(result.current.canEnterZenReason).toBe('available')

      // Pause session -> paused: still available
      await act(async () => {
        await result.current.pauseSession()
      })
      expect(result.current.activeSession?.status).toBe('paused')
      expect(result.current.canEnterZen).toBe(true)
      expect(result.current.canEnterZenReason).toBe('available')

      // Stop session -> idle: no-session
      await act(async () => {
        await result.current.stopSession()
      })
      expect(result.current.activeSession).toBeNull()
      expect(result.current.canEnterZen).toBe(false)
      expect(result.current.canEnterZenReason).toBe('no-session')
    })

    it('invokes onSessionFinalized callback on successful manual stop and timed completion', async () => {
      const onSessionFinalized = vi.fn()
      const { result } = renderHook(() => useFocusSession({ subjectMap, onSessionFinalized }))
      await waitFor(() => expect(result.current.canStartFocus).toBe(true))

      await act(async () => {
        await result.current.startSession()
      })
      const sessionId = result.current.activeSession?.id
      expect(sessionId).toBeDefined()

      await act(async () => {
        await result.current.stopSession()
      })

      expect(onSessionFinalized).toHaveBeenCalledTimes(1)
      expect(onSessionFinalized).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          outcome: 'stopped',
          history: expect.objectContaining({
            id: sessionId,
          }),
        }),
      )
    })

    it('handles capacity_limit on startSession by setting capacity notice and not starting session', async () => {
      const { result } = renderHook(() => useFocusSession({ subjectMap }))
      await waitFor(() => expect(result.current.canStartFocus).toBe(true))

      // Fill storage to 65 MiB (over 64 MiB limit)
      const oversizedBody = 'Z'.repeat(65 * 1024 * 1024)
      await studyDb.notes.add({
        id: 'oversized-note',
        title: 'Oversized Note',
        body: oversizedBody,
        subjectId: '',
        tags: [],
        createdAt: '2026-08-30T00:00:00.000Z',
        updatedAt: '2026-08-30T00:00:00.000Z',
      })

      await act(async () => {
        await result.current.startSession()
      })

      expect(result.current.activeSession).toBeNull()
      expect(result.current.sessionNotice).toBe(
        'Study storage is at its backup-safe capacity. Remove or reduce some saved data before adding more content.'
      )

      await studyDb.notes.delete('oversized-note')
    })
  })
})
