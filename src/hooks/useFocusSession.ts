import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatMinutes } from '../appUtils'
import {
  checkpointActiveFocusSession,
  createActiveFocusSession,
  type CreateActiveFocusSessionResult,
  discardActiveFocusSession,
  finalizeActiveFocusSession,
  getActiveFocusElapsedMs,
  getActiveFocusSession,
  getActiveFocusSessionWithGeneration,
  isActiveFocusSessionStale,
  pauseActiveFocusSession,
  resumeActiveFocusSession,
  shouldAutoCompleteFocusSession,
  updateActiveFocusSession,
} from '../db/activeFocusSession'
import { DataOperationCoordinator, type IDataOperationCoordinator } from '../db/dataCoordinator'
import { StaleDatabaseGenerationError } from '../db/databaseGeneration'
import { createId, nowIso } from '../db/studyDb'
import type { ActiveFocusSession, StudySubject } from '../db/types'

export type UseFocusSessionOptions = {
  subjectMap: Map<string, StudySubject>
  coordinator?: IDataOperationCoordinator
}

export type UseFocusSessionResult = {
  activeSession: ActiveFocusSession | null
  staleFocusSession: ActiveFocusSession | null
  staleFocusSubjectName: string
  sessionLimitSeconds: number
  elapsedSeconds: number
  remainingSeconds: number
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

type LiveAnchor = {
  sessionId: string
  baseElapsedMs: number
  perfStartMs: number
}

function getLiveAnchorNowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : 0
}

function createLiveAnchor(sessionId: string, baseElapsedMs: number): LiveAnchor {
  return {
    sessionId,
    baseElapsedMs,
    perfStartMs: getLiveAnchorNowMs(),
  }
}

function calculateRunningElapsed(session: ActiveFocusSession, anchor: LiveAnchor | null): number {
  if (!anchor || anchor.sessionId !== session.id) {
    return getActiveFocusElapsedMs(session, Date.now())
  }

  const perfNow = getLiveAnchorNowMs()
  const perfDelta = Math.max(0, perfNow - anchor.perfStartMs)
  return anchor.baseElapsedMs + perfDelta
}

/**
 * Focus-session React orchestration: restore, start/pause/resume/stop, stale
 * decisions, subject updates, timed auto-complete with sync pending refs, and
 * import/clear coordination helpers. Domain persistence stays in activeFocusSession.
 */
export function useFocusSession({ subjectMap, coordinator: optionsCoordinator }: UseFocusSessionOptions): UseFocusSessionResult {
  const coordinator = useMemo(() => optionsCoordinator ?? new DataOperationCoordinator(), [optionsCoordinator])
  const [focusSubjectId, setFocusSubjectId] = useState('')
  const [focusDurationMinutes, setFocusDurationMinutes] = useState(25)
  const [sessionNotice, setSessionNotice] = useState('')
  const [activeSession, setActiveSession] = useState<ActiveFocusSession | null>(null)
  const [staleFocusSession, setStaleFocusSession] = useState<ActiveFocusSession | null>(null)
  const [focusRestoreReady, setFocusRestoreReady] = useState(false)
  const [focusTransitionPending, setFocusTransitionPending] = useState(false)
  const [focusImportPending, setFocusImportPending] = useState(false)
  const [liveElapsedMs, setLiveElapsedMs] = useState(0)

  const focusGenerationRef = useRef<number>(1)
  const finalizingSessionIdRef = useRef<string | null>(null)
  const deferredAutoCompleteSessionIdRef = useRef<string | null>(null)
  const focusTransitionPendingRef = useRef(false)
  const focusImportPendingRef = useRef(false)
  const focusSubjectWriteSeqRef = useRef(0)
  const liveAnchorRef = useRef<LiveAnchor | null>(null)

  /** Clears both React focus slots, then applies at most one persisted session (never both). */
  const applyPersistedFocusSession = useCallback((restored: ActiveFocusSession | null) => {
    deferredAutoCompleteSessionIdRef.current = null
    setActiveSession(null)
    setStaleFocusSession(null)
    if (!restored) {
      liveAnchorRef.current = null
      setLiveElapsedMs(0)
      return
    }
    if (isActiveFocusSessionStale(restored)) {
      liveAnchorRef.current = null
      setLiveElapsedMs(0)
      setStaleFocusSession(restored)
      return
    }
    const base = getActiveFocusElapsedMs(restored)
    liveAnchorRef.current = createLiveAnchor(restored.id, base)
    setLiveElapsedMs(base)
    setActiveSession(restored)
    setFocusSubjectId(restored.subjectId)
    setFocusDurationMinutes(restored.plannedMinutes)
  }, [])

  const reloadFocusFromIndexedDb = useCallback(async () => {
    try {
      const { session: restored, generation } = await getActiveFocusSessionWithGeneration()
      focusGenerationRef.current = generation
      applyPersistedFocusSession(restored)
      finalizingSessionIdRef.current = null
      setFocusRestoreReady(true)
      setSessionNotice((prev) => (prev === 'Active focus session could not be loaded due to a storage error.' ? '' : prev))
      return restored
    } catch (err) {
      setFocusRestoreReady(false)
      setSessionNotice('Active focus session could not be loaded due to a storage error.')
      throw err
    }
  }, [applyPersistedFocusSession])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { session: restored, generation } = await getActiveFocusSessionWithGeneration()
        if (cancelled) return
        focusGenerationRef.current = generation
        applyPersistedFocusSession(restored)
        setFocusRestoreReady(true)
      } catch {
        if (cancelled) return
        setFocusRestoreReady(false)
        setSessionNotice('Active focus session could not be loaded due to a storage error.')
      }
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
    const base = getActiveFocusElapsedMs(session)
    liveAnchorRef.current = createLiveAnchor(session.id, base)
    setLiveElapsedMs(base)
    setActiveSession(session)
    setFocusSubjectId(session.subjectId)
    setFocusDurationMinutes(session.plannedMinutes)
    setSessionNotice(notice)
  }, [])

  // Authoritative live timer interval
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running') {
      return undefined
    }

    if (!liveAnchorRef.current || liveAnchorRef.current.sessionId !== activeSession.id) {
      const base = getActiveFocusElapsedMs(activeSession)
      liveAnchorRef.current = createLiveAnchor(activeSession.id, base)
    } else if (
      typeof activeSession.checkpointElapsedMs === 'number' &&
      activeSession.checkpointElapsedMs > liveAnchorRef.current.baseElapsedMs
    ) {
      const currentLive = calculateRunningElapsed(activeSession, liveAnchorRef.current)
      if (activeSession.checkpointElapsedMs > currentLive) {
        liveAnchorRef.current = createLiveAnchor(activeSession.id, activeSession.checkpointElapsedMs)
      }
    }

    const timer = window.setInterval(() => {
      const current = calculateRunningElapsed(activeSession, liveAnchorRef.current)
      setLiveElapsedMs((prev) => Math.max(prev, current))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [activeSession])

  // Periodic and visibility-based durable running checkpoint
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running') return undefined

    const performCheckpoint = async () => {
      if (focusTransitionPendingRef.current || focusImportPendingRef.current || !coordinator.getSnapshot().canMutateFocus) {
        return
      }
      if (!liveAnchorRef.current || liveAnchorRef.current.sessionId !== activeSession.id) return

      const currentElapsed = calculateRunningElapsed(activeSession, liveAnchorRef.current)
      const currentDurable = activeSession.checkpointElapsedMs ?? 0
      if (currentElapsed <= currentDurable) return

      try {
        await coordinator.runFocusWrite(async () => {
          const result = await checkpointActiveFocusSession(activeSession.id, currentElapsed, {
            expectedGeneration: focusGenerationRef.current,
          })
          if (result.ok) {
            setActiveSession(result.session)
          }
        })
      } catch {
        // Best-effort checkpoint: failure must not reset live timer or throw unhandled rejection
      }
    }

    const intervalTimer = window.setInterval(() => {
      void performCheckpoint()
    }, 30_000)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void performCheckpoint()
      }
    }
    const onPageHide = () => {
      void performCheckpoint()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      window.clearInterval(intervalTimer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [activeSession, coordinator])

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
      checkpointElapsedMs: 0,
    }

    const res = await coordinator.runFocusWrite(async () => {
      try {
        let candidateSession = { ...session }
        let result: CreateActiveFocusSessionResult = { ok: false, reason: 'id_collision' }
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) {
            candidateSession = {
              ...candidateSession,
              id: createId('focus'),
            }
          }
          result = await createActiveFocusSession(candidateSession, {
            expectedGeneration: focusGenerationRef.current,
          })
          if (result.ok || result.reason !== 'id_collision') {
            break
          }
        }

        if (result.ok) {
          deferredAutoCompleteSessionIdRef.current = null
          focusGenerationRef.current = result.generation
          liveAnchorRef.current = createLiveAnchor(result.session.id, 0)
          setLiveElapsedMs(0)
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
          return
        }

        if (result.reason === 'missing_subject') {
          deferredAutoCompleteSessionIdRef.current = null
          setSessionNotice('The selected subject is no longer available.')
          return
        }

        if (result.reason === 'id_collision') {
          deferredAutoCompleteSessionIdRef.current = null
          setSessionNotice('Could not start the focus session due to an ID collision. Try again.')
          return
        }
      } catch (err) {
        if (err instanceof StaleDatabaseGenerationError) {
          setSessionNotice('Data was modified in another tab or import. Refresh to continue.')
          return
        }
        setSessionNotice('Could not start the focus session. Try again.')
      }
    })

    if (!res.ok) {
      setSessionNotice('A data operation is currently in progress. Please wait.')
    }
  }, [activeSession, coordinator, focusActionsPending, focusDurationMinutes, focusRestoreReady, focusSubjectId, hydrateActiveSession, staleFocusSession])

  const acceptStaleFocusSession = useCallback(async () => {
    if (!staleFocusSession || focusActionsPending) return

    setFocusTransitionPending(true)
    try {
      const res = await coordinator.runFocusWrite(async () => {
        const { session: current, generation } = await getActiveFocusSessionWithGeneration()
        focusGenerationRef.current = generation
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
      })

      if (!res.ok) {
        setSessionNotice('A data operation is currently in progress. Please wait.')
      }
    } catch {
      setSessionNotice('Could not resume the unfinished focus session. Try again.')
    } finally {
      setFocusTransitionPending(false)
    }
  }, [coordinator, focusActionsPending, hydrateActiveSession, staleFocusSession])

  const discardStaleFocusSession = useCallback(async () => {
    if (!staleFocusSession || focusActionsPending) return

    setFocusTransitionPending(true)
    try {
      const res = await coordinator.runFocusWrite(async () => {
        const result = await discardActiveFocusSession(staleFocusSession.id, {
          expectedGeneration: focusGenerationRef.current,
        })
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
      })

      if (!res.ok) {
        setSessionNotice('A data operation is currently in progress. Please wait.')
      }
    } catch (err) {
      if (err instanceof StaleDatabaseGenerationError) {
        deferredAutoCompleteSessionIdRef.current = null
        setStaleFocusSession(null)
        setSessionNotice('The database was updated elsewhere. Focus session discarded.')
        return
      }
      setSessionNotice('Could not discard the unfinished focus session. Try again.')
    } finally {
      setFocusTransitionPending(false)
    }
  }, [coordinator, focusActionsPending, hydrateActiveSession, staleFocusSession])

  const finalizeFocusSession = useCallback(async (sessionToFinalize: ActiveFocusSession, completed: boolean) => {
    let currentSession = sessionToFinalize
    if (finalizingSessionIdRef.current === currentSession.id) return

    if (deferredAutoCompleteSessionIdRef.current === currentSession.id) {
      deferredAutoCompleteSessionIdRef.current = null
    }
    finalizingSessionIdRef.current = currentSession.id

    for (let attempt = 0; attempt < 3; attempt++) {
      const currentElapsed = calculateRunningElapsed(currentSession, liveAnchorRef.current)
      const actualMinutes = Math.round(currentElapsed / 60_000)
      const minutes = Math.max(1, completed && currentSession.plannedMinutes > 0 ? currentSession.plannedMinutes : actualMinutes)

      const safeStartedAt = currentSession.startedAt
      const safeEndedAt = new Date(Math.max(Date.parse(safeStartedAt), Date.now())).toISOString()

      try {
        const result = await finalizeActiveFocusSession(currentSession.id, {
          subjectId: currentSession.subjectId,
          startedAt: safeStartedAt,
          endedAt: safeEndedAt,
          minutes,
          note: completed ? 'Completed focus session' : currentSession.subjectId ? 'Focus session' : 'General focus session',
        }, {
          expectedGeneration: focusGenerationRef.current,
        })

        if (!result.ok) {
          deferredAutoCompleteSessionIdRef.current = null
          if (result.reason === 'id_rekeyed') {
            const rekeyedSession = result.session
            setActiveSession(rekeyedSession)
            if (liveAnchorRef.current && liveAnchorRef.current.sessionId === currentSession.id) {
              liveAnchorRef.current = {
                ...liveAnchorRef.current,
                sessionId: rekeyedSession.id,
              }
            }
            finalizingSessionIdRef.current = rekeyedSession.id
            currentSession = rekeyedSession
            continue
          }

          if (result.reason === 'conflict') {
            hydrateActiveSession(result.existing, 'Focus session was updated elsewhere.')
            return
          }

          if (result.reason === 'missing_subject') {
            setSessionNotice('The selected subject is no longer available. Study time was not logged.')
            return
          }

          liveAnchorRef.current = null
          setLiveElapsedMs(0)
          setActiveSession(null)
          setStaleFocusSession(null)
          setSessionNotice('That focus session is no longer saved. It was removed from the screen without logging study time.')
          return
        }

        deferredAutoCompleteSessionIdRef.current = null
        liveAnchorRef.current = null
        setLiveElapsedMs(0)
        setActiveSession(null)
        setSessionNotice(completed ? `Session complete: ${formatMinutes(result.history.minutes)} logged.` : `Session stopped: ${formatMinutes(result.history.minutes)} logged.`)
        return
      } catch (err) {
        if (err instanceof StaleDatabaseGenerationError) {
          deferredAutoCompleteSessionIdRef.current = null
          liveAnchorRef.current = null
          setLiveElapsedMs(0)
          setActiveSession(null)
          setStaleFocusSession(null)
          setSessionNotice('The database was updated elsewhere. Study time was not logged.')
          return
        }
        setSessionNotice('Could not stop the focus session. Try again.')
        return
      } finally {
        if (finalizingSessionIdRef.current === currentSession.id) {
          finalizingSessionIdRef.current = null
        }
      }
    }
  }, [hydrateActiveSession])

  const evaluateTimedCompletion = useCallback(async (expectedSessionId: string) => {
    const clearDeferredForExpected = () => {
      if (deferredAutoCompleteSessionIdRef.current === expectedSessionId) {
        deferredAutoCompleteSessionIdRef.current = null
      }
    }

    if (focusTransitionPendingRef.current || focusImportPendingRef.current || !coordinator.getSnapshot().canMutateFocus) {
      deferredAutoCompleteSessionIdRef.current = expectedSessionId
      return
    }

    try {
      const res = await coordinator.runFocusWrite(async () => {
        // Attempt best-effort checkpoint of live progress before evaluating
        if (liveAnchorRef.current && liveAnchorRef.current.sessionId === expectedSessionId) {
          const currentElapsed = calculateRunningElapsed(activeSession ?? {
            id: expectedSessionId,
            subjectId: '',
            startedAt: nowIso(),
            plannedMinutes: 25,
            status: 'running',
            pausedAt: null,
            accumulatedPausedMs: 0,
          }, liveAnchorRef.current)
          try {
            await checkpointActiveFocusSession(expectedSessionId, currentElapsed, {
              expectedGeneration: focusGenerationRef.current,
            })
          } catch {
            // best effort
          }
        }

        const durable = await getActiveFocusSession()
        if (!durable || durable.id !== expectedSessionId) {
          clearDeferredForExpected()
          return
        }

        if (durable.status !== 'running' || durable.plannedMinutes <= 0) {
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

        clearDeferredForExpected()
        await finalizeFocusSession(durable, true)
      })

      if (!res.ok) {
        deferredAutoCompleteSessionIdRef.current = expectedSessionId
      }
    } catch {
      deferredAutoCompleteSessionIdRef.current = expectedSessionId
    }
  }, [activeSession, coordinator, finalizeFocusSession])

  useEffect(() => {
    const unsubscribe = coordinator.subscribe(() => {
      const deferredId = deferredAutoCompleteSessionIdRef.current
      if (deferredId && coordinator.getSnapshot().canMutateFocus) {
        window.setTimeout(() => {
          if (deferredAutoCompleteSessionIdRef.current === deferredId) {
            void evaluateTimedCompletion(deferredId)
          }
        }, 0)
      }
    })
    return unsubscribe
  }, [coordinator, evaluateTimedCompletion])

  const settleFocusTransition = useCallback(() => {
    focusTransitionPendingRef.current = false
    setFocusTransitionPending(false)
    const deferredId = deferredAutoCompleteSessionIdRef.current
    if (!deferredId) return
    deferredAutoCompleteSessionIdRef.current = null
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
      const currentElapsed = calculateRunningElapsed(activeSession, liveAnchorRef.current)

      const res = await coordinator.runFocusWrite(async () => {
        const result = await pauseActiveFocusSession(activeSession.id, {
          pausedAt: nowIso(),
          logicalElapsedMs: currentElapsed,
        }, {
          expectedGeneration: focusGenerationRef.current,
        })
        if (result.ok) {
          const finalElapsed = result.session.checkpointElapsedMs ?? currentElapsed
          liveAnchorRef.current = createLiveAnchor(result.session.id, finalElapsed)
          setLiveElapsedMs(finalElapsed)
          setActiveSession(result.session)
          setSessionNotice('')
          return
        }
        if (result.reason === 'conflict' || result.reason === 'invalid_state') {
          hydrateActiveSession(result.existing, 'Focus session was updated elsewhere.')
          return
        }
        setSessionNotice('Could not pause the focus session. Try again.')
      })

      if (!res.ok) {
        setSessionNotice('A data operation is currently in progress. Please wait.')
      }
    } catch (err) {
      if (err instanceof StaleDatabaseGenerationError) {
        deferredAutoCompleteSessionIdRef.current = null
        liveAnchorRef.current = null
        setLiveElapsedMs(0)
        setActiveSession(null)
        setStaleFocusSession(null)
        setSessionNotice('The database was updated elsewhere.')
        return
      }
      setSessionNotice('Could not pause the focus session. Try again.')
    } finally {
      settleFocusTransition()
    }
  }, [activeSession, coordinator, focusActionsPending, hydrateActiveSession, settleFocusTransition])

  const resumeSession = useCallback(async () => {
    if (!activeSession || activeSession.status !== 'paused' || focusActionsPending) return
    if (finalizingSessionIdRef.current === activeSession.id) return

    focusTransitionPendingRef.current = true
    setFocusTransitionPending(true)
    try {
      const res = await coordinator.runFocusWrite(async () => {
        const result = await resumeActiveFocusSession(activeSession.id, Date.now(), {
          expectedGeneration: focusGenerationRef.current,
        })
        if (result.ok) {
          const base = result.session.checkpointElapsedMs ?? getActiveFocusElapsedMs(result.session)
          liveAnchorRef.current = createLiveAnchor(result.session.id, base)
          setLiveElapsedMs(base)
          setActiveSession(result.session)
          setSessionNotice('')
          return
        }
        if (result.reason === 'conflict' || result.reason === 'invalid_state') {
          hydrateActiveSession(result.existing, 'Focus session was updated elsewhere.')
          return
        }
        setSessionNotice('Could not resume the focus session. Try again.')
      })

      if (!res.ok) {
        setSessionNotice('A data operation is currently in progress. Please wait.')
      }
    } catch (err) {
      if (err instanceof StaleDatabaseGenerationError) {
        deferredAutoCompleteSessionIdRef.current = null
        liveAnchorRef.current = null
        setLiveElapsedMs(0)
        setActiveSession(null)
        setStaleFocusSession(null)
        setSessionNotice('The database was updated elsewhere.')
        return
      }
      setSessionNotice('Could not resume the focus session. Try again.')
    } finally {
      settleFocusTransition()
    }
  }, [activeSession, coordinator, focusActionsPending, hydrateActiveSession, settleFocusTransition])

  const stopSession = useCallback(async (completed = false) => {
    if (!activeSession) return
    if (finalizingSessionIdRef.current === activeSession.id || focusActionsPending) return

    const res = await coordinator.runFocusWrite(async () => {
      await finalizeFocusSession(activeSession, completed)
    })

    if (!res.ok) {
      setSessionNotice('A data operation is currently in progress. Please wait.')
    }
  }, [activeSession, coordinator, finalizeFocusSession, focusActionsPending])

  // Timed auto-completion scheduling effect
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running' || activeSession.plannedMinutes <= 0) return undefined

    const sessionId = activeSession.id
    const limitMs = activeSession.plannedMinutes * 60_000
    const currentElapsed = calculateRunningElapsed(activeSession, liveAnchorRef.current)
    const remainingMs = Math.max(0, limitMs - currentElapsed)

    const timer = window.setTimeout(() => {
      if (focusTransitionPendingRef.current || focusImportPendingRef.current || !coordinator.getSnapshot().canMutateFocus) {
        deferredAutoCompleteSessionIdRef.current = sessionId
        return
      }
      void evaluateTimedCompletion(sessionId)
    }, remainingMs)
    return () => window.clearTimeout(timer)
  }, [activeSession, coordinator, evaluateTimedCompletion, liveElapsedMs])

  const updateFocusSubject = useCallback((subjectId: string) => {
    setFocusSubjectId(subjectId)
    if (!activeSession || focusActionsPending) return

    const baseline = activeSession
    const writeSeq = ++focusSubjectWriteSeqRef.current
    const currentElapsed = calculateRunningElapsed(activeSession, liveAnchorRef.current)

    const nextSession: ActiveFocusSession = {
      ...activeSession,
      subjectId,
      checkpointElapsedMs: Math.max(activeSession.checkpointElapsedMs ?? 0, Math.floor(currentElapsed)),
    }
    setActiveSession(nextSession)

    void (async () => {
      const res = await coordinator.runFocusWrite(async () => {
        try {
          const result = await updateActiveFocusSession(nextSession, {
            expectedGeneration: focusGenerationRef.current,
          })
          if (writeSeq !== focusSubjectWriteSeqRef.current) return

          if (result.ok) {
            setActiveSession(result.session)
            return
          }

          if (result.reason === 'conflict') {
            hydrateActiveSession(result.existing, 'Focus session was updated elsewhere.')
            return
          }

          if (result.reason === 'missing_subject') {
            try {
              const durable = await getActiveFocusSession()
              if (writeSeq !== focusSubjectWriteSeqRef.current) return
              if (durable) {
                hydrateActiveSession(durable, 'The selected subject is no longer available.')
                return
              }
            } catch {
              // Fall back to baseline if durable re-read fails
            }
            if (writeSeq !== focusSubjectWriteSeqRef.current) return
            setActiveSession(baseline)
            setFocusSubjectId(baseline.subjectId)
            setSessionNotice('The selected subject is no longer available.')
            return
          }

          try {
            const durable = await getActiveFocusSession()
            if (writeSeq !== focusSubjectWriteSeqRef.current) return
            if (durable) {
              hydrateActiveSession(durable, 'Could not update the focus subject. Try again.')
              return
            }
          } catch {
            // Fall back to baseline if durable re-read fails
          }
          if (writeSeq !== focusSubjectWriteSeqRef.current) return
          setActiveSession(baseline)
          setFocusSubjectId(baseline.subjectId)
          setSessionNotice('Could not update the focus subject. Try again.')
        } catch (err) {
          if (writeSeq !== focusSubjectWriteSeqRef.current) return
          if (err instanceof StaleDatabaseGenerationError) {
            setActiveSession(null)
            setStaleFocusSession(null)
            setSessionNotice('The database was updated elsewhere.')
            return
          }
          try {
            const durable = await getActiveFocusSession()
            if (writeSeq !== focusSubjectWriteSeqRef.current) return
            if (durable) {
              hydrateActiveSession(durable, 'Could not update the focus subject. Try again.')
              return
            }
          } catch {
            // Fall back to baseline if durable re-read fails
          }
          if (writeSeq !== focusSubjectWriteSeqRef.current) return
          setActiveSession(baseline)
          setFocusSubjectId(baseline.subjectId)
          setSessionNotice('Could not update the focus subject. Try again.')
        }
      })

      if (!res.ok) {
        if (writeSeq === focusSubjectWriteSeqRef.current) {
          setActiveSession(baseline)
          setFocusSubjectId(baseline.subjectId)
          setSessionNotice('A data operation is currently in progress. Please wait.')
        }
      }
    })()
  }, [activeSession, coordinator, focusActionsPending, hydrateActiveSession])

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
    focusGenerationRef.current = 1
    liveAnchorRef.current = null
    setLiveElapsedMs(0)
    setActiveSession(null)
    setStaleFocusSession(null)
    finalizingSessionIdRef.current = null
    deferredAutoCompleteSessionIdRef.current = null
    focusTransitionPendingRef.current = false
    focusImportPendingRef.current = false
  }, [])

  const elapsedSeconds = activeSession
    ? Math.max(0, Math.floor(liveElapsedMs / 1000))
    : 0
  const remainingSeconds = sessionLimitSeconds > 0
    ? Math.max(0, sessionLimitSeconds - elapsedSeconds)
    : 0

  return {
    activeSession,
    staleFocusSession,
    staleFocusSubjectName,
    sessionLimitSeconds,
    elapsedSeconds,
    remainingSeconds,
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
