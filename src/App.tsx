import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  getTodayFocusMinutes,
  getWeeklyStudyDays,
  isFlashcardDue,
  percent,
  startOfToday,
} from './appUtils'
import { useAppSearch } from './hooks/useAppSearch'
import { useCurrentDate } from './hooks/useCurrentDate'
import { useFocusSession } from './hooks/useFocusSession'
import { useSidebarPreference } from './hooks/useSidebarPreference'
import { useStudyBackup } from './hooks/useStudyBackup'
import { useThemePreference } from './hooks/useThemePreference'
import { migrateLegacyLocalStorage } from './db/studyDb'
import { EMPTY_APP_SHELL_DATA, getAppShellData } from './db/appShellRead'
import { listCalendarEvents } from './db/calendarEventRead'
import { listFlashcards } from './db/flashcardRead'
import { listNotes } from './db/noteRead'
import { listTasks } from './db/taskRead'
import { listStudySessions } from './db/studySessionRead'
import { EMPTY_UI_SETTINGS, getUiSettings } from './db/uiSettingsRead'
import { saveQuickNotes } from './db/quickNotesService'
import type { ActiveFocusSession, CalendarEvent, Flashcard, StudySession, StudyTask } from './db/types'
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
import {
  pathForView,
  pathnamesMatch,
  resolveViewFromPathname,
  type View,
} from './navigation/viewRoutes'

export type { View }
export type SettingsFeedback = { tone: 'success' | 'error'; message: string }
/** @deprecated Use ActiveFocusSession — kept as alias for existing imports. */
export type ActiveSession = ActiveFocusSession
/** Re-exported for existing consumers; prefer `./hooks/useThemePreference`. */
export type { ThemeMode } from './hooks/useThemePreference'

const EMPTY_EVENTS: CalendarEvent[] = []
const EMPTY_FLASHCARDS: Flashcard[] = []
const EMPTY_TASKS: StudyTask[] = []
const EMPTY_STUDY_SESSIONS: StudySession[] = []

function App() {
  const [activeView, setActiveView] = useState<View>(() => resolveViewFromPathname(window.location.pathname).view)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [taskFilter, setTaskFilter] = useState<'all' | 'open' | 'done'>('all')
  const [taskEditorRequest, setTaskEditorRequest] = useState(0)
  const [subjectEditorRequest, setSubjectEditorRequest] = useState(0)
  const [progressEditorRequested, setProgressEditorRequested] = useState(false)
  const [profileNotice, setProfileNotice] = useState('')
  const [preferenceNotice, setPreferenceNotice] = useState<string | null>(null)
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

  const syncUrlToView = useCallback((view: View, historyMode: 'push' | 'replace') => {
    const nextPath = pathForView(view)
    if (pathnamesMatch(window.location.pathname, nextPath)) return
    if (historyMode === 'replace') {
      window.history.replaceState(null, '', nextPath)
      return
    }
    window.history.pushState(null, '', nextPath)
  }, [])

  const navigateToView = useCallback((view: View) => {
    setProgressEditorRequested(false)
    setTaskEditorRequest(0)
    setSubjectEditorRequest(0)
    setActiveView(view)
    syncUrlToView(view, 'push')
  }, [syncUrlToView])

  useEffect(() => {
    void migrateLegacyLocalStorage()
  }, [])

  useEffect(() => {
    const resolved = resolveViewFromPathname(window.location.pathname)
    if (resolved.needsReplace) {
      syncUrlToView(resolved.view, 'replace')
    }
  }, [syncUrlToView])

  useEffect(() => {
    const onPopState = () => {
      const resolved = resolveViewFromPathname(window.location.pathname)
      if (resolved.needsReplace) {
        syncUrlToView(resolved.view, 'replace')
      }
      setProgressEditorRequested(false)
      setTaskEditorRequest(0)
      setSubjectEditorRequest(0)
      setActiveView(resolved.view)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [syncUrlToView])

  const liveData = useLiveQuery(() => getAppShellData(), [])
  const liveNotes = useLiveQuery(() => listNotes(), [])
  const liveEvents = useLiveQuery(() => listCalendarEvents(), [])
  const liveFlashcards = useLiveQuery(() => listFlashcards(), [])
  const liveTasks = useLiveQuery(() => listTasks(), [])
  const liveStudySessions = useLiveQuery(() => listStudySessions(), [])
  const liveUiSettings = useLiveQuery(() => getUiSettings(), [])
  const data = liveData ?? EMPTY_APP_SHELL_DATA
  const notes = liveNotes ?? []
  const events = liveEvents ?? EMPTY_EVENTS
  const flashcards = liveFlashcards ?? EMPTY_FLASHCARDS
  const tasks = liveTasks ?? EMPTY_TASKS
  const studySessions = liveStudySessions ?? EMPTY_STUDY_SESSIONS
  const uiSettings = liveUiSettings ?? EMPTY_UI_SETTINGS
  // Wait for shell + extracted App reads so consumers never paint an empty flash after partial readiness.
  const isLoading = liveData === undefined || liveNotes === undefined || liveEvents === undefined || liveFlashcards === undefined || liveTasks === undefined || liveStudySessions === undefined || liveUiSettings === undefined

  const currentDate = useCurrentDate()
  const dailyGoalMinutes = uiSettings.dailyGoalMinutes
  const quickNotes = uiSettings.quickNotes
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
  } = useAppSearch({ data, notes, events, flashcards, tasks, studySessions, subjectMap, taskFilter })
  const {
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
  } = useFocusSession({ subjectMap })
  const onBackupClearSuccess = useCallback(() => {
    setProfileNotice('All study data has been permanently deleted.')
    navigateToView('Home')
    setTimeout(() => setProfileNotice(''), 5000)
  }, [navigateToView])
  const { exportBackup, importBackup, clearAllBackup } = useStudyBackup({
    runWithFocusImportLock,
    reloadFocusFromIndexedDb,
    clearFocusLocalState,
    onClearSuccess: onBackupClearSuccess,
  })
  const todayFocusMinutes = useMemo(
    () => getTodayFocusMinutes(studySessions, currentDate),
    [currentDate, studySessions],
  )
  const weeklyStudyDays = useMemo(
    () => getWeeklyStudyDays(studySessions, currentDate),
    [currentDate, studySessions],
  )
  const completedTasks = useMemo(() => tasks.filter((task) => task.status === 'done'), [tasks])
  const upcomingEvents = useMemo(
    () => events.filter((event) => new Date(event.startAt).getTime() >= startOfToday(currentDate)).slice(0, 4),
    [currentDate, events],
  )
  const dueCards = useMemo(() => flashcards.filter((card) => isFlashcardDue(card)), [flashcards])

  useEffect(() => {
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    document.scrollingElement?.scrollTo?.({ behavior, top: 0 })
  }, [activeView])

  const addQuickNote = useCallback(async (value: string) => {
    await saveQuickNotes(value)
  }, [])

  const openNewTask = () => {
    setProgressEditorRequested(false)
    setSubjectEditorRequest(0)
    setActiveView('Tasks')
    syncUrlToView('Tasks', 'push')
    setTaskEditorRequest((request) => request + 1)
  }

  const openNewSubject = () => {
    setProgressEditorRequested(false)
    setTaskEditorRequest(0)
    setActiveView('Subjects')
    syncUrlToView('Subjects', 'push')
    setSubjectEditorRequest((request) => request + 1)
  }

  const openManualSession = () => {
    setTaskEditorRequest(0)
    setSubjectEditorRequest(0)
    setProgressEditorRequested(true)
    setActiveView('Progress')
    syncUrlToView('Progress', 'push')
  }

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
                    notes={notes}
                    events={events}
                    flashcards={flashcards}
                    tasks={tasks}
                    studySessions={studySessions}
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
                    tasks={tasks}
                    notes={notes}
                    events={events}
                    flashcards={flashcards}
                    sessions={studySessions}
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
                    tasks={tasks}
                    studySessions={studySessions}
                    flashcards={flashcards}
                    weeklyStudyDays={weeklyStudyDays}
                    dailyGoalMinutes={dailyGoalMinutes}
                    todayFocusMinutes={todayFocusMinutes}
                    subjectMap={subjectMap}
                    openEditorOnMount={progressEditorRequested}
                  />
                ) : null}
                {activeView === 'Goals' ? (
                  <GoalsView
                    dailyGoalMinutes={dailyGoalMinutes}
                    studySessions={studySessions}
                  />
                ) : null}
                {activeView === 'Settings' ? (
                  <SettingsView
                    onExport={exportBackup}
                    onImport={importBackup}
                    onClear={clearAllBackup}
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
                  <StreakCard sessions={studySessions} now={currentDate} />
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

export default App
