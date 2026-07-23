import { useCallback, useEffect, useRef, useState } from 'react'
import { formatMinutes } from '../appUtils'
import {
  createActiveFocusSession,
  discardActiveFocusSession,
  finalizeActiveFocusSession,
  getActiveFocusElapsedMs,
  getActiveFocusSession,
  isActiveFocusSessionStale,
  pauseActiveFocusSession,
  resumeActiveFocusSession,
  shouldAutoCompleteFocusSession,
  updateActiveFocusSession,
} from '../db/activeFocusSession'
import { createId, nowIso } from '../db/studyDb'
import type { ActiveFocusSession, StudySubject } from '../db/types'

export type UseFocusSessionOptions = {
  subjectMap: Map<string, StudySubject>
}

export type UseFocusSessionResult = {
  activeSession: ActiveFocusSession | null
  staleFocusSession: ActiveFocusSession | null
  staleFocusSubjectName: string
  sessionLimitSeconds: number
  sessionNotice: string
  canStartFocus: boolean
  focusActionsPending: boolean
  focusImportPending: boolean
  focusSubjectId: string
  focusDurationMinutes: number
  setFocusDurationMinutes: (minutes: number) => void
  updateFocusSubject: (subjectId: string) => void
  startSession: () => Promise<void>
  pauseSession: () => Promise<void>
  resumeSession: () => Promise<void>
  stopSession: (completed?: boolean) => Promise<void>
  acceptStaleFocusSession: () => Promise<void>
  discardStaleFocusSession: () => Promise<void>
  reloadFocusFromIndexedDb: () => Promise<ActiveFocusSession | null>
  /** Holds sync + React import pending for the full await window (including post-import reload). */
  runWithFocusImportLock: <T>(action: () => Promise<T>) => Promise<T>
  /** Clears local focus UI/refs after clear-all without re-reading IndexedDB. */
  clearFocusLocalState: () => void
}

/**
 * Focus-session React orchestration: restore, start/pause/resume/stop, stale
 * decisions, subject updates, timed auto-complete with sync pending refs, and
 * import/clear coordination helpers. Domain persistence stays in activeFocusSession.
 */
export function useFocusSession({ subjectMap }: UseFocusSessionOptions): UseFocusSessionResult {
  const [focusSubjectId, setFocusSubjectId] = useState('')
  const [focusDurationMinutes, setFocusDurationMinutes] = useState(25)
  const [sessionNotice, setSessionNotice] = useState('')
  const [activeSession, setActiveSession] = useState<ActiveFocusSession | null>(null)
  const [staleFocusSession, setStaleFocusSession] = useState<ActiveFocusSession | null>(null)
  const [focusRestoreReady, setFocusRestoreReady] = useState(false)
  const [focusTransitionPending, setFocusTransitionPending] = useState(false)
  const [focusImportPending, setFocusImportPending] = useState(false)
  const finalizingSessionIdRef = useRef<string | null>(null)
  const deferredAutoCompleteSessionIdRef = useRef<string | null>(null)
  const focusTransitionPendingRef = useRef(false)
  const focusImportPendingRef = useRef(false)
  const focusSubjectWriteSeqRef = useRef(0)

  /** Clears both React focus slots, then applies at most one persisted session (never both). */
  const applyPersistedFocusSession = useCallback((restored: ActiveFocusSession | null) => {
    deferredAutoCompleteSessionIdRef.current = null
    setActiveSession(null)
    setStaleFocusSession(null)
    if (!restored) return
    if (isActiveFocusSessionStale(restored)) {
      setStaleFocusSession(restored)
      return
    }
    setActiveSession(restored)
    setFocusSubjectId(restored.subjectId)
    setFocusDurationMinutes(restored.plannedMinutes)
  }, [])

  const reloadFocusFromIndexedDb = useCallback(async () => {
    const restored = await getActiveFocusSession()
    applyPersistedFocusSession(restored)
    finalizingSessionIdRef.current = null
    setFocusRestoreReady(true)
    return restored
  }, [applyPersistedFocusSession])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const restored = await getActiveFocusSession()
      if (cancelled) return
      applyPersistedFocusSession(restored)
      setFocusRestoreReady(true)
    })()
    return () => {
      cancelled = true
      deferredAutoCompleteSessionIdRef.current = null
    }
  }, [applyPersistedFocusSession])

  const sessionLimitSeconds = activeSession && activeSession.plannedMinutes > 0 ? activeSession.plannedMinutes * 60 : 0
  const focusActionsPending = focusTransitionPending || focusImportPending
  const canStartFocus = focusRestoreReady && !focusImportPending && !activeSession && !staleFocusSession
  const staleFocusSubjectName = staleFocusSession
    ? (subjectMap.get(staleFocusSession.subjectId)?.name ?? (staleFocusSession.subjectId ? 'Unknown subject' : 'General'))
    : ''

  const hydrateActiveSession = useCallback((session: ActiveFocusSession, notice = '') => {
    setActiveSession(session)
    setFocusSubjectId(session.subjectId)
    setFocusDurationMinutes(session.plannedMinutes)
    setSessionNotice(notice)
  }, [])

  const startSession = useCallback(async () => {
    if (!focusRestoreReady || activeSession || staleFocusSession || focusActionsPending) return

    const session: ActiveFocusSession = {
      id: createId('focus'),
      subjectId: focusSubjectId,
      startedAt: nowIso(),
      plannedMinutes: focusDurationMinutes,
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: 0,
    }

    try {
      const result = await createActiveFocusSession(session)
      if (result.ok) {
        deferredAutoCompleteSessionIdRef.current = null
        setActiveSession(result.session)
        setSessionNotice('')
        return
      }

      if (result.reason === 'conflict') {
        deferredAutoCompleteSessionIdRef.current = null
        if (isActiveFocusSessionStale(result.existing)) {
          setStaleFocusSession(result.existing)
          setSessionNotice('An unfinished focus session needs a decision before you start another.')
          return
        }
        hydrateActiveSession(result.existing, 'An unfinished focus session was restored.')
      }
    } catch {
      setSessionNotice('Could not start the focus session. Try again.')
    }
  }, [activeSession, focusActionsPending, focusDurationMinutes, focusRestoreReady, focusSubjectId, hydrateActiveSession, staleFocusSession])

  const acceptStaleFocusSession = useCallback(async () => {
    if (!staleFocusSession || focusActionsPending) return

    setFocusTransitionPending(true)
    try {
      const current = await getActiveFocusSession()
      if (!current) {
        deferredAutoCompleteSessionIdRef.current = null
        setStaleFocusSession(null)
        setSessionNotice('That unfinished focus session is no longer available.')
        return
      }

      if (current.id !== staleFocusSession.id) {
        deferredAutoCompleteSessionIdRef.current = null
        if (isActiveFocusSessionStale(current)) {
          setStaleFocusSession(current)
          setSessionNotice('Focus session was updated elsewhere.')
          return
        }
        setStaleFocusSession(null)
        hydrateActiveSession(current, 'Focus session was updated elsewhere.')
        return
      }

      setStaleFocusSession(null)
      hydrateActiveSession(current)
    } catch {
      setSessionNotice('Could not resume the unfinished focus session. Try again.')
    } finally {
      setFocusTransitionPending(false)
    }
  }, [focusActionsPending, hydrateActiveSession, staleFocusSession])

  const discardStaleFocusSession = useCallback(async () => {
    if (!staleFocusSession || focusActionsPending) return

    setFocusTransitionPending(true)
    try {
      const result = await discardActiveFocusSession(staleFocusSession.id)
      if (result.ok) {
        deferredAutoCompleteSessionIdRef.current = null
        setStaleFocusSession(null)
        setSessionNotice('Unfinished focus session discarded.')
        return
      }

      if (result.reason === 'conflict') {
        deferredAutoCompleteSessionIdRef.current = null
        if (isActiveFocusSessionStale(result.existing)) {
          setStaleFocusSession(result.existing)
          setSessionNotice('Focus session was updated elsewhere.')
          return
        }
        setStaleFocusSession(null)
        hydrateActiveSession(result.existing, 'Focus session was updated elsewhere.')
        return
      }

      deferredAutoCompleteSessionIdRef.current = null
      setStaleFocusSession(null)
      setSessionNotice('That unfinished focus session is no longer available.')
    } catch {
      setSessionNotice('Could not discard the unfinished focus session. Try again.')
    } finally {
      setFocusTransitionPending(false)
    }
  }, [focusActionsPending, hydrateActiveSession, staleFocusSession])

  const finalizeFocusSession = useCallback(async (sessionToFinalize: ActiveFocusSession, completed: boolean) => {
    if (finalizingSessionIdRef.current === sessionToFinalize.id) return

    if (deferredAutoCompleteSessionIdRef.current === sessionToFinalize.id) {
      deferredAutoCompleteSessionIdRef.current = null
    }
    finalizingSessionIdRef.current = sessionToFinalize.id
    const elapsedMs = getActiveFocusElapsedMs(sessionToFinalize)
    const actualMinutes = Math.round(elapsedMs / 60_000)
    const minutes = Math.max(1, completed && sessionToFinalize.plannedMinutes > 0 ? sessionToFinalize.plannedMinutes : actualMinutes)

    try {
      const result = await finalizeActiveFocusSession(sessionToFinalize.id, {
        subjectId: sessionToFinalize.subjectId,
        startedAt: sessionToFinalize.startedAt,
        endedAt: nowIso(),
        minutes,
        note: completed ? 'Completed focus session' : sessionToFinalize.subjectId ? 'Focus session' : 'General focus session',
      })

      if (!result.ok) {
        deferredAutoCompleteSessionIdRef.current = null
        if (result.reason === 'conflict') {
          hydrateActiveSession(result.existing, 'Focus session was updated elsewhere.')
          return
        }

        // Durable singleton already gone — clear obsolete React focus UI without logging history.
        setActiveSession(null)
        setStaleFocusSession(null)
        setSessionNotice('That focus session is no longer saved. It was removed from the screen without logging study time.')
        return
      }

      deferredAutoCompleteSessionIdRef.current = null
      setActiveSession(null)
      setSessionNotice(completed ? `Session complete: ${formatMinutes(result.history.minutes)} logged.` : `Session stopped: ${formatMinutes(result.history.minutes)} logged.`)
    } catch {
      // Keep local + durable unfinished state recoverable after a persistence failure.
      setSessionNotice('Could not stop the focus session. Try again.')
    } finally {
      if (finalizingSessionIdRef.current === sessionToFinalize.id) {
        finalizingSessionIdRef.current = null
      }
    }
  }, [hydrateActiveSession])

  const evaluateTimedCompletion = useCallback(async (expectedSessionId: string) => {
    const clearDeferredForExpected = () => {
      if (deferredAutoCompleteSessionIdRef.current === expectedSessionId) {
        deferredAutoCompleteSessionIdRef.current = null
      }
    }

    if (focusTransitionPendingRef.current || focusImportPendingRef.current) {
      deferredAutoCompleteSessionIdRef.current = expectedSessionId
      return
    }

    try {
      const durable = await getActiveFocusSession()
      if (!durable || durable.id !== expectedSessionId) {
        clearDeferredForExpected()
        return
      }

      if (!shouldAutoCompleteFocusSession(durable)) {
        clearDeferredForExpected()
        return
      }

      if (finalizingSessionIdRef.current === durable.id) {
        clearDeferredForExpected()
        return
      }

      await finalizeFocusSession(durable, true)
    } finally {
      clearDeferredForExpected()
    }
  }, [finalizeFocusSession])

  const settleFocusTransition = useCallback(() => {
    focusTransitionPendingRef.current = false
    setFocusTransitionPending(false)
    const deferredId = deferredAutoCompleteSessionIdRef.current
    if (!deferredId) return
    deferredAutoCompleteSessionIdRef.current = null
    // Yield so React can commit pause/resume failure notices before deferred
    // auto-complete reuses the shared sessionNotice slot.
    window.setTimeout(() => {
      void evaluateTimedCompletion(deferredId)
    }, 0)
  }, [evaluateTimedCompletion])

  const pauseSession = useCallback(async () => {
    if (!activeSession || activeSession.status !== 'running' || focusActionsPending) return
    if (finalizingSessionIdRef.current === activeSession.id) return

    focusTransitionPendingRef.current = true
    setFocusTransitionPending(true)
    try {
      const result = await pauseActiveFocusSession(activeSession.id)
      if (result.ok) {
        setActiveSession(result.session)
        setSessionNotice('')
        return
      }
      if (result.reason === 'conflict' || result.reason === 'invalid_state') {
        hydrateActiveSession(result.existing, 'Focus session was updated elsewhere.')
        return
      }
      setSessionNotice('Could not pause the focus session. Try again.')
    } catch {
      setSessionNotice('Could not pause the focus session. Try again.')
    } finally {
      settleFocusTransition()
    }
  }, [activeSession, focusActionsPending, hydrateActiveSession, settleFocusTransition])

  const resumeSession = useCallback(async () => {
    if (!activeSession || activeSession.status !== 'paused' || focusActionsPending) return
    if (finalizingSessionIdRef.current === activeSession.id) return

    focusTransitionPendingRef.current = true
    setFocusTransitionPending(true)
    try {
      const result = await resumeActiveFocusSession(activeSession.id)
      if (result.ok) {
        setActiveSession(result.session)
        setSessionNotice('')
        return
      }
      if (result.reason === 'conflict' || result.reason === 'invalid_state') {
        hydrateActiveSession(result.existing, 'Focus session was updated elsewhere.')
        return
      }
      setSessionNotice('Could not resume the focus session. Try again.')
    } catch {
      setSessionNotice('Could not resume the focus session. Try again.')
    } finally {
      settleFocusTransition()
    }
  }, [activeSession, focusActionsPending, hydrateActiveSession, settleFocusTransition])

  const stopSession = useCallback(async (completed = false) => {
    if (!activeSession) return
    if (finalizingSessionIdRef.current === activeSession.id || focusActionsPending) return

    await finalizeFocusSession(activeSession, completed)
  }, [activeSession, finalizeFocusSession, focusActionsPending])

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running' || activeSession.plannedMinutes <= 0) return undefined

    const sessionId = activeSession.id
    const limitMs = activeSession.plannedMinutes * 60_000
    const remainingMs = Math.max(0, limitMs - getActiveFocusElapsedMs(activeSession))

    const timer = window.setTimeout(() => {
      if (focusTransitionPendingRef.current || focusImportPendingRef.current) {
        deferredAutoCompleteSessionIdRef.current = sessionId
        return
      }
      void evaluateTimedCompletion(sessionId)
    }, remainingMs)
    return () => window.clearTimeout(timer)
  }, [activeSession, evaluateTimedCompletion])

  const updateFocusSubject = useCallback((subjectId: string) => {
    setFocusSubjectId(subjectId)
    if (!activeSession || focusActionsPending) return

    const baseline = activeSession
    const writeSeq = ++focusSubjectWriteSeqRef.current
    const nextSession: ActiveFocusSession = { ...activeSession, subjectId }
    setActiveSession(nextSession)

    void (async () => {
      try {
        const result = await updateActiveFocusSession(nextSession)
        if (writeSeq !== focusSubjectWriteSeqRef.current) return

        if (result.ok) {
          setActiveSession(result.session)
          return
        }

        if (result.reason === 'conflict') {
          hydrateActiveSession(result.existing, 'Focus session was updated elsewhere.')
          return
        }

        const durable = await getActiveFocusSession()
        if (writeSeq !== focusSubjectWriteSeqRef.current) return
        if (durable) {
          hydrateActiveSession(durable, 'Could not update the focus subject. Try again.')
          return
        }

        setActiveSession(baseline)
        setFocusSubjectId(baseline.subjectId)
        setSessionNotice('Could not update the focus subject. Try again.')
      } catch {
        if (writeSeq !== focusSubjectWriteSeqRef.current) return
        const durable = await getActiveFocusSession()
        if (writeSeq !== focusSubjectWriteSeqRef.current) return
        if (durable) {
          hydrateActiveSession(durable, 'Could not update the focus subject. Try again.')
          return
        }
        setActiveSession(baseline)
        setFocusSubjectId(baseline.subjectId)
        setSessionNotice('Could not update the focus subject. Try again.')
      }
    })()
  }, [activeSession, focusActionsPending, hydrateActiveSession])

  const runWithFocusImportLock = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    focusImportPendingRef.current = true
    setFocusImportPending(true)
    try {
      return await action()
    } finally {
      focusImportPendingRef.current = false
      setFocusImportPending(false)
    }
  }, [])

  const clearFocusLocalState = useCallback(() => {
    setActiveSession(null)
    setStaleFocusSession(null)
    finalizingSessionIdRef.current = null
    deferredAutoCompleteSessionIdRef.current = null
    focusTransitionPendingRef.current = false
    focusImportPendingRef.current = false
  }, [])

  return {
    activeSession,
    staleFocusSession,
    staleFocusSubjectName,
    sessionLimitSeconds,
    sessionNotice,
    canStartFocus,
    focusActionsPending,
    focusImportPending,
    focusSubjectId,
    focusDurationMinutes,
    setFocusDurationMinutes,
    updateFocusSubject,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    acceptStaleFocusSession,
    discardStaleFocusSession,
    reloadFocusFromIndexedDb,
    runWithFocusImportLock,
    clearFocusLocalState,
  }
}
