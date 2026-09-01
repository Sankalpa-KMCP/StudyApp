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
    const updateSpy = vi.spyOn(activeFocusSession, 'updateActiveFocusSession').mockResolvedValue({
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

  it('restores the prior subject when the durable session is missing after an update', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))

    await studyDb.settings.delete(activeFocusSession.ACTIVE_FOCUS_SESSION_KEY)

    act(() => {
      result.current.updateFocusSubject('subject-b')
    })

    await waitFor(() => expect(result.current.sessionNotice).toBe('Could not update the focus subject. Try again.'))
    expect(result.current.activeSession).toMatchObject({ id: 'focus-hook', subjectId: 'subject-a' })
    expect(result.current.focusSubjectId).toBe('subject-a')
    expect(await getActiveFocusSession()).toBeNull()
  })

  it('rehydrates a durable session when subject update returns missing but one still exists', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    const durable = makeSession({ subjectId: 'subject-a', plannedMinutes: 35 })
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))

    vi.spyOn(activeFocusSession, 'updateActiveFocusSession').mockResolvedValue({
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

  it('restores the prior subject when subject persistence throws and no durable session remains', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result } = renderHook(() => useFocusSession({ subjectMap }))
    await waitFor(() => expect(result.current.activeSession?.id).toBe('focus-hook'))

    vi.spyOn(activeFocusSession, 'updateActiveFocusSession').mockRejectedValue(new Error('subject write failed'))
    vi.spyOn(activeFocusSession, 'getActiveFocusSession').mockResolvedValue(null)

    act(() => {
      result.current.updateFocusSubject('subject-b')
    })

    await waitFor(() => expect(result.current.sessionNotice).toBe('Could not update the focus subject. Try again.'))
    expect(result.current.activeSession).toMatchObject({ id: 'focus-hook', subjectId: 'subject-a' })
    expect(result.current.focusSubjectId).toBe('subject-a')
  })

  it('rehydrates durable state when subject persistence throws but IndexedDB still has the session', async () => {
    await createActiveFocusSession(makeSession(), { expectedGeneration: 1 })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(activeFocusSession, 'updateActiveFocusSession').mockRejectedValue(new Error('subject write failed'))

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
    const updateSpy = vi.spyOn(activeFocusSession, 'updateActiveFocusSession')
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
    const realUpdate = activeFocusSession.updateActiveFocusSession
    const updateSpy = vi.spyOn(activeFocusSession, 'updateActiveFocusSession')
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
  })
})
