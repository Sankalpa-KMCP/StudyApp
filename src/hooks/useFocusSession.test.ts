import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
})
