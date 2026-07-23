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
import { useThemePreference } from './hooks/useThemePreference'
import {
  clearAllStudyData,
  exportStudyData,
  getStudyData,
  importStudyData,
  migrateLegacyLocalStorage,
  studyDb,
} from './db/studyDb'
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

  const navigateToView = useCallback((view: View) => {
    setProgressEditorRequested(false)
    setActiveView(view)
  }, [])

  useEffect(() => {
    void migrateLegacyLocalStorage()
  }, [])

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
    await runWithFocusImportLock(async () => {
      await importStudyData(JSON.parse(await file.text()) as unknown)
      await reloadFocusFromIndexedDb()
    })
  }

  const openNewTask = () => {
    navigateToView('Tasks')
    setTaskEditorRequest((request) => request + 1)
  }

  const handleClearData = async () => {
    await clearAllStudyData()
    clearFocusLocalState()
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
