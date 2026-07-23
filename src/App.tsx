import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  getTodayFocusMinutes,
  getWeeklyStudyDays,
  isFlashcardDue,
  percent,
  startOfToday,
  formatMinutes,
} from './appUtils'
import { useAppSearch } from './hooks/useAppSearch'
import { useCurrentDate } from './hooks/useCurrentDate'
import { useSidebarPreference } from './hooks/useSidebarPreference'
import { useThemePreference } from './hooks/useThemePreference'
import {
  clearAllStudyData,
  createId,
  exportStudyData,
  getStudyData,
  importStudyData,
  migrateLegacyLocalStorage,
  nowIso,
  studyDb,
} from './db/studyDb'
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
} from './db/activeFocusSession'
import type { ActiveFocusSession, StudyData } from './db/types'
import { ReviewQueue, StreakCard, Upcoming, WeeklyProgress } from './components/RightColumn'
import { HomeView } from './home/HomeView'
import { TasksView } from './views/TasksView'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { HeroRow } from './components/HeroRow'
import { NotesView } from './views/NotesView'
import { SubjectsView } from './views/SubjectsView'
import { CalendarView } from './views/CalendarView'
import { FlashcardsView } from './views/FlashcardsView'
import { ProgressView } from './views/ProgressView'
import { GoalsView } from './views/GoalsView'
import { SettingsView } from './views/SettingsView'

export type View = 'Home' | 'Tasks' | 'Notes' | 'Subjects' | 'Calendar' | 'Flashcards' | 'Progress' | 'Goals' | 'Settings'
export type SettingsFeedback = { tone: 'success' | 'error'; message: string }
/** @deprecated Use ActiveFocusSession — kept as alias for existing imports. */
export type ActiveSession = ActiveFocusSession
/** Re-exported for existing consumers; prefer `./hooks/useThemePreference`. */
export type { ThemeMode } from './hooks/useThemePreference'

const EMPTY_DATA: StudyData = {
  tasks: [],
  subjects: [],
  notes: [],
  events: [],
  flashcards: [],
  studySessions: [],
  goals: [],
  settings: [],
}

function App() {
  const [activeView, setActiveView] = useState<View>('Home')
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [taskFilter, setTaskFilter] = useState<'all' | 'open' | 'done'>('all')
  const [taskEditorRequest, setTaskEditorRequest] = useState(0)
  const [subjectEditorRequest, setSubjectEditorRequest] = useState(0)
  const [progressEditorRequested, setProgressEditorRequested] = useState(false)
  const [profileNotice, setProfileNotice] = useState('')
  const [preferenceNotice, setPreferenceNotice] = useState<string | null>(null)
  const [focusSubjectId, setFocusSubjectId] = useState('')
  const [focusDurationMinutes, setFocusDurationMinutes] = useState(25)
  const [sessionNotice, setSessionNotice] = useState('')
  const clearPreferenceNotice = useCallback(() => setPreferenceNotice(null), [])
  const reportPreferenceError = useCallback((message: string) => setPreferenceNotice(message), [])
  const { theme, setTheme } = useThemePreference({
    onPreferenceError: reportPreferenceError,
    clearPreferenceNotice,
  })
  const { sidebarCollapsed, toggleSidebarCollapsed } = useSidebarPreference({
    onPreferenceError: reportPreferenceError,
    clearPreferenceNotice,
  })
  const [revealedCards, setRevealedCards] = useState<Set<string>>(() => new Set())
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

  const navigateToView = useCallback((view: View) => {
    setProgressEditorRequested(false)
    setActiveView(view)
  }, [])

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
    void migrateLegacyLocalStorage()
  }, [])

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

  const liveData = useLiveQuery(() => getStudyData(), [])
  const data = liveData ?? EMPTY_DATA
  const isLoading = liveData === undefined

  const currentDate = useCurrentDate()
  const dailyGoalMinutes = useMemo(() => settingNumber(data, 'dailyGoalMinutes', 240), [data])
  const quickNotes = useMemo(() => settingStringArray(data, 'quickNotes'), [data])
  const subjectMap = useMemo(() => new Map(data.subjects.map((subject) => [subject.id, subject])), [data.subjects])
  const {
    search,
    setSearch,
    deferredSearch,
    clearSearch,
    homeSearchResults,
    filteredTasks,
    filteredNotes,
    filteredSubjects,
    filteredEvents,
    filteredFlashcards,
  } = useAppSearch({ data, subjectMap, taskFilter })
  const todayFocusMinutes = useMemo(
    () => getTodayFocusMinutes(data.studySessions, currentDate),
    [currentDate, data.studySessions],
  )
  const weeklyStudyDays = useMemo(
    () => getWeeklyStudyDays(data.studySessions, currentDate),
    [currentDate, data.studySessions],
  )
  const completedTasks = useMemo(() => data.tasks.filter((task) => task.status === 'done'), [data.tasks])
  const upcomingEvents = useMemo(
    () => data.events.filter((event) => new Date(event.startAt).getTime() >= startOfToday(currentDate)).slice(0, 4),
    [currentDate, data.events],
  )
  const dueCards = useMemo(() => data.flashcards.filter((card) => isFlashcardDue(card)), [data.flashcards])
  const sessionLimitSeconds = activeSession && activeSession.plannedMinutes > 0 ? activeSession.plannedMinutes * 60 : 0
  const focusActionsPending = focusTransitionPending || focusImportPending
  const canStartFocus = focusRestoreReady && !focusImportPending && !activeSession && !staleFocusSession
  const staleFocusSubjectName = staleFocusSession
    ? (subjectMap.get(staleFocusSession.subjectId)?.name ?? (staleFocusSession.subjectId ? 'Unknown subject' : 'General'))
    : ''

  useEffect(() => {
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    document.scrollingElement?.scrollTo?.({ behavior, top: 0 })
  }, [activeView])

  const addQuickNote = useCallback(async (value: string) => {
    await studyDb.settings.put({
      key: 'quickNotes',
      value: value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 8),
    })
  }, [])

  const exportData = async () => {
    let objectUrl: string | null = null
    try {
      const payload = await exportStudyData()
      const serialized = JSON.stringify(payload, null, 2)
      const filename = `study-dashboard-${new Date().toISOString().slice(0, 10)}.json`
      const blob = new Blob([serialized], { type: 'application/json' })
      objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = filename
      anchor.click()
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }

  const importData = async (file: File) => {
    focusImportPendingRef.current = true
    setFocusImportPending(true)
    try {
      await importStudyData(JSON.parse(await file.text()) as unknown)
      await reloadFocusFromIndexedDb()
    } finally {
      focusImportPendingRef.current = false
      setFocusImportPending(false)
    }
  }

  const openNewTask = () => {
    navigateToView('Tasks')
    setTaskEditorRequest((request) => request + 1)
  }

  const handleClearData = async () => {
    await clearAllStudyData()
    setActiveSession(null)
    setStaleFocusSession(null)
    finalizingSessionIdRef.current = null
    deferredAutoCompleteSessionIdRef.current = null
    focusTransitionPendingRef.current = false
    focusImportPendingRef.current = false
    setProfileNotice('All study data has been permanently deleted.')
    navigateToView('Home')
    setTimeout(() => setProfileNotice(''), 5000)
  }

  const openNewSubject = () => {
    navigateToView('Subjects')
    setSubjectEditorRequest((request) => request + 1)
  }

  const openManualSession = () => {
    setProgressEditorRequested(true)
    setActiveView('Progress')
  }

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

  const closeNotices = useCallback(() => setNoticeOpen(false), [])
  const toggleNotices = useCallback(() => setNoticeOpen((open) => !open), [])

  return (
    <div className={sidebarCollapsed ? 'app-shell is-sidebar-collapsed' : 'app-shell'}>
      <a className="skip-link" href="#dashboard-main">Skip to dashboard</a>
      <Sidebar
        activeView={activeView}
        collapsed={sidebarCollapsed}
        onNavigate={navigateToView}
        onToggleCollapsed={toggleSidebarCollapsed}
      />
      <div className="workspace">
        <Topbar
          activeView={activeView}
          search={search}
          noticeOpen={noticeOpen}
          noticePopoverId="notice-popover"
          onSearch={setSearch}
          onClearSearch={clearSearch}
          onToggleNotices={toggleNotices}
          onCloseNotices={closeNotices}
          onOpenProfile={() => {
            navigateToView('Settings')
            setProfileNotice('Profile settings live in this local Settings workspace for now.')
          }}
        />
        {noticeOpen ? (
          <div id="notice-popover" className="notice-popover" role="status">
            <strong>{completedTasks.length} completed tasks</strong>
            <span>{Math.round(percent(todayFocusMinutes, dailyGoalMinutes))}% of today&apos;s focus target is done.</span>
          </div>
        ) : null}
        <main id="dashboard-main" className="dashboard" aria-label="Study dashboard">
          {isLoading ? (
            <section className="loading-panel" aria-live="polite">Loading your study space...</section>
          ) : (
            <div className={activeView === 'Home' ? 'content-grid' : 'content-grid is-workspace-view'}>
              <section className="primary-column" aria-label="Primary study summary">
                {profileNotice ? <div className="settings-feedback" role="status">{profileNotice}</div> : null}
                {preferenceNotice && activeView !== 'Settings' ? (
                  <div className="settings-feedback error" role="alert">{preferenceNotice}</div>
                ) : null}
                {activeView === 'Home' ? (
                  <HeroRow
                    currentDate={currentDate}
                    todayFocusMinutes={todayFocusMinutes}
                    dailyGoalMinutes={dailyGoalMinutes}
                    onCreateTask={openNewTask}
                    onCreateSubject={openNewSubject}
                  />
                ) : null}
                {activeView === 'Home' ? (
                  <HomeView
                    data={data}
                    subjectMap={subjectMap}
                    weeklyStudyDays={weeklyStudyDays}
                    quickNotes={quickNotes}
                    dailyGoalMinutes={dailyGoalMinutes}
                    todayFocusMinutes={todayFocusMinutes}
                    activeSession={activeSession}
                    staleFocusSession={staleFocusSession}
                    staleFocusSubjectName={staleFocusSubjectName}
                    sessionLimitSeconds={sessionLimitSeconds}
                    sessionNotice={sessionNotice}
                    canStartFocus={canStartFocus}
                    focusTransitionPending={focusActionsPending}
                    subjects={data.subjects}
                    focusSubjectId={focusSubjectId}
                    focusDurationMinutes={focusDurationMinutes}
                    search={deferredSearch}
                    searchResults={homeSearchResults}
                    onFocusSubjectChange={updateFocusSubject}
                    onFocusDurationChange={setFocusDurationMinutes}
                    onQuickNotesChange={addQuickNote}
                    onStartSession={() => void startSession()}
                    onPauseSession={() => void pauseSession()}
                    onResumeSession={() => void resumeSession()}
                    onStopSession={() => stopSession(false)}
                    onAcceptStaleFocusSession={() => void acceptStaleFocusSession()}
                    onDiscardStaleFocusSession={() => void discardStaleFocusSession()}
                    onNavigate={navigateToView}
                    onCreateSubject={openNewSubject}
                    onCreatePlan={openNewTask}
                    onLogSession={openManualSession}
                  />
                ) : null}
                {activeView === 'Tasks' ? (
                  <TasksView tasks={filteredTasks} subjects={data.subjects} filter={taskFilter} openEditorRequest={taskEditorRequest} onFilterChange={setTaskFilter} search={deferredSearch} onClearSearch={clearSearch} />
                ) : null}
                {activeView === 'Notes' ? <NotesView notes={filteredNotes} subjects={data.subjects} subjectMap={subjectMap} search={deferredSearch} onClearSearch={clearSearch} /> : null}
                {activeView === 'Subjects' ? (
                  <SubjectsView
                    subjects={filteredSubjects}
                    tasks={data.tasks}
                    notes={data.notes}
                    events={data.events}
                    flashcards={data.flashcards}
                    sessions={data.studySessions}
                    openEditorRequest={subjectEditorRequest}
                  />
                ) : null}
                {activeView === 'Calendar' ? (
                  <CalendarView events={filteredEvents} subjects={data.subjects} subjectMap={subjectMap} search={deferredSearch} onClearSearch={clearSearch} />
                ) : null}
                {activeView === 'Flashcards' ? (
                  <FlashcardsView
                    cards={filteredFlashcards}
                    subjects={data.subjects}
                    subjectMap={subjectMap}
                    revealedCards={revealedCards}
                    onToggleReveal={(id) =>
                      setRevealedCards((current) => {
                        const next = new Set(current)
                        if (next.has(id)) next.delete(id)
                        else next.add(id)
                        return next
                      })
                    }
                  />
                ) : null}
                {activeView === 'Progress' ? (
                  <ProgressView
                    data={data}
                    weeklyStudyDays={weeklyStudyDays}
                    dailyGoalMinutes={dailyGoalMinutes}
                    todayFocusMinutes={todayFocusMinutes}
                    subjectMap={subjectMap}
                    openEditorOnMount={progressEditorRequested}
                  />
                ) : null}
                {activeView === 'Goals' ? (
                  <GoalsView
                    goals={data.goals}
                    dailyGoalMinutes={dailyGoalMinutes}
                    studySessions={data.studySessions}
                  />
                ) : null}
                {activeView === 'Settings' ? (
                  <SettingsView
                    onExport={exportData}
                    onImport={importData}
                    onClear={handleClearData}
                    importPending={focusImportPending}
                    profileNotice={profileNotice}
                    preferenceNotice={preferenceNotice}
                    onDismissPreferenceNotice={() => setPreferenceNotice(null)}
                    theme={theme}
                    onThemeChange={setTheme}
                  />
                ) : null}
              </section>
              {activeView === 'Home' ? (
                <aside className="right-column" aria-label="Progress and schedule">
                  <WeeklyProgress days={weeklyStudyDays} />
                  <Upcoming events={upcomingEvents} subjectMap={subjectMap} onViewAll={() => navigateToView('Calendar')} />
                  <StreakCard sessions={data.studySessions} now={currentDate} />
                  <ReviewQueue count={dueCards.length} onOpen={() => navigateToView('Flashcards')} />
                </aside>
              ) : null}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}


function settingNumber(data: StudyData, key: string, fallback: number) {
  const value = data.settings.find((setting) => setting.key === key)?.value
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function settingStringArray(data: StudyData, key: string) {
  const value = data.settings.find((setting) => setting.key === key)?.value
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export default App
