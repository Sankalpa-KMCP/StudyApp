import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as activeFocusSession from '../db/activeFocusSession'
import {
  ACTIVE_FOCUS_SESSION_STALE_AFTER_MS,
  createActiveFocusSession,
  getActiveFocusSession,
} from '../db/activeFocusSession'
import { studyDb } from '../db/studyDb'
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
    vi.useRealTimers()
    vi.restoreAllMocks()
    await studyDb.delete()
    await studyDb.open()
  })

  it('restores a running session and blocks Start until restore completes', async () => {
    await createActiveFocusSession(makeSession({ plannedMinutes: 40 }))

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
    }))

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
    await createActiveFocusSession(makeSession())
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
    await createActiveFocusSession(makeSession())
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
    await createActiveFocusSession(makeSession())
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
    await createActiveFocusSession(makeSession())
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
    await createActiveFocusSession(makeSession())
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
    await createActiveFocusSession(makeSession())
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
    await createActiveFocusSession(makeSession())
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
    await createActiveFocusSession(makeSession())
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
    await createActiveFocusSession(makeSession())
    let releaseFirst!: (result: activeFocusSession.UpdateActiveFocusSessionResult) => void
    const firstGate = new Promise<activeFocusSession.UpdateActiveFocusSessionResult>((resolve) => {
      releaseFirst = resolve
    })
    const realUpdate = activeFocusSession.updateActiveFocusSession
    const updateSpy = vi.spyOn(activeFocusSession, 'updateActiveFocusSession')
      .mockImplementationOnce(() => firstGate)
      .mockImplementation((session) => realUpdate(session))

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
    await waitFor(() => expect(result.current.canStartFocus).toBe(false)) // canStartFocus false because no session yet, but restore ready

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
})

