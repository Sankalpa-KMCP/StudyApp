import { useCallback, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  getTodayFocusMinutes,
  getWeeklyStudyDays,
  percent,
  startOfToday,
} from './appUtils'
import { useAppSearch } from './hooks/useAppSearch'
import { useCurrentDate } from './hooks/useCurrentDate'
import { listCalendarEvents } from './db/calendarEventRead'
import { listNotes } from './db/noteRead'
import { listTasks } from './db/taskRead'
import { listStudySessions } from './db/studySessionRead'
import { EMPTY_UI_SETTINGS, getUiSettings } from './db/uiSettingsRead'
import { getDatabaseGeneration } from './db/databaseGeneration'
import type { DatabaseMutationContext } from './db/databaseMutationGuard'
import { studyDb } from './db/studyDb'
import { listSubjects } from './db/subjectRead'
import { saveQuickNotes } from './db/quickNotesService'
import type { ActiveFocusSession, CalendarEvent, StudySession, StudySubject, StudyTask } from './db/types'
import { StreakCard, Upcoming, WeeklyProgress } from './components/RightColumn'
import { HomeView } from './home/HomeView'
import { TasksView } from './views/TasksView'
import { Topbar } from './components/Topbar'
import { HeroRow } from './components/HeroRow'
import { NotesView } from './views/NotesView'
import { SubjectsView } from './views/SubjectsView'
import { CalendarView } from './views/CalendarView'
import { ProgressView } from './views/ProgressView'
import { GoalsView } from './views/GoalsView'
import { SettingsView } from './views/SettingsView'
import type { ThemeMode } from './hooks/useThemePreference'
import type { View } from './navigation/viewRoutes'
import type { QuickAddItem } from './components/QuickAddMenu'

const EMPTY_EVENTS: CalendarEvent[] = []
const EMPTY_TASKS: StudyTask[] = []
const EMPTY_STUDY_SESSIONS: StudySession[] = []
const EMPTY_SUBJECTS: StudySubject[] = []

import type { DataCoordinatorSnapshot } from './db/dataCoordinator'

export type AppLiveDataProps = {
  coordinatorState?: DataCoordinatorSnapshot
  activeView: View
  taskFilter: 'all' | 'open' | 'done'
  onTaskFilterChange: (filter: 'all' | 'open' | 'done') => void
  taskEditorRequest: number
  subjectEditorRequest: number
  noteEditorRequest: number
  eventEditorRequest: number
  focusAttentionRequest: number
  progressEditorRequested: boolean
  noticeOpen: boolean
  noticePopoverId: string
  onToggleNotices: () => void
  onCloseNotices: () => void
  profileNotice: string
  preferenceNotice: string | null
  onDismissPreferenceNotice: () => void
  theme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
  onNavigate: (view: View) => void
  onOpenProfile: () => void
  onQuickAdd: (item: QuickAddItem) => void
  onCreateTask: () => void
  onCreateSubject: () => void
  onRevealFocusSession: () => void
  onSubjectMapChange: (subjectMap: Map<string, StudySubject>) => void
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
  onFocusSubjectChange: (subjectId: string) => void
  onFocusDurationChange: (minutes: number) => void
  onStartSession: () => void
  onPauseSession: () => void
  onResumeSession: () => void
  onStopSession: () => Promise<void>
  onAcceptStaleFocusSession: () => void
  onDiscardStaleFocusSession: () => void
  onExport: () => Promise<void>
  onImport: (file: File) => Promise<unknown>
  onClear: () => Promise<void>
  onDismissOnboardingChecklist: () => Promise<void>
  onShowOnboardingChecklist: () => Promise<void>
}

/**
 * App-owned live IndexedDB reads and the data-dependent workspace UI.
 * Remounted by App's live-read ErrorBoundary Retry without remounting shell
 * navigation, preferences, focus ownership, or backup orchestration.
 */
export function AppLiveData({
  coordinatorState,
  activeView,
  taskFilter,
  onTaskFilterChange,
  taskEditorRequest,
  subjectEditorRequest,
  noteEditorRequest,
  eventEditorRequest,
  focusAttentionRequest,
  progressEditorRequested,
  noticeOpen,
  noticePopoverId,
  onToggleNotices,
  onCloseNotices,
  profileNotice,
  preferenceNotice,
  onDismissPreferenceNotice,
  theme,
  onThemeChange,
  onNavigate,
  onOpenProfile,
  onQuickAdd,
  onCreateTask,
  onCreateSubject,
  onRevealFocusSession,
  onSubjectMapChange,
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
  onFocusSubjectChange,
  onFocusDurationChange,
  onStartSession,
  onPauseSession,
  onResumeSession,
  onStopSession,
  onAcceptStaleFocusSession,
  onDiscardStaleFocusSession,
  onExport,
  onImport,
  onClear,
  onDismissOnboardingChecklist,
  onShowOnboardingChecklist,
}: AppLiveDataProps) {
  const liveSubjects = useLiveQuery(() => listSubjects(), [])
  const liveNotes = useLiveQuery(() => listNotes(), [])
  const liveEvents = useLiveQuery(() => listCalendarEvents(), [])
  const liveTasks = useLiveQuery(() => listTasks(), [])
  const liveStudySessions = useLiveQuery(() => listStudySessions(), [])
  const liveUiSettings = useLiveQuery(() => getUiSettings(), [])
  const liveGeneration = useLiveQuery(() => getDatabaseGeneration(studyDb.settings), [])
  const subjects = liveSubjects ?? EMPTY_SUBJECTS
  const notes = liveNotes ?? []
  const events = liveEvents ?? EMPTY_EVENTS
  const tasks = liveTasks ?? EMPTY_TASKS
  const studySessions = liveStudySessions ?? EMPTY_STUDY_SESSIONS
  const uiSettings = liveUiSettings ?? EMPTY_UI_SETTINGS
  const databaseGeneration = liveGeneration ?? 1
  // Wait for all App-owned live reads so consumers never paint an empty flash after partial readiness.
  const isLoading = liveSubjects === undefined || liveNotes === undefined || liveEvents === undefined || liveTasks === undefined || liveStudySessions === undefined || liveUiSettings === undefined || liveGeneration === undefined

  const currentDate = useCurrentDate()
  const dailyGoalMinutes = uiSettings.dailyGoalMinutes
  const quickNotes = uiSettings.quickNotes
  const onboardingChecklistDismissed = uiSettings.onboardingChecklistDismissed
  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects])

  useEffect(() => {
    onSubjectMapChange(subjectMap)
  }, [onSubjectMapChange, subjectMap])

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
  } = useAppSearch({ subjects, notes, events, tasks, studySessions, subjectMap, taskFilter, now: currentDate })

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

  const addQuickNote = useCallback(async (value: string, context: DatabaseMutationContext) => {
    await saveQuickNotes(value, context)
  }, [])

  return (
    <>
      <Topbar
        activeView={activeView}
        search={search}
        searchResults={homeSearchResults}
        noticeOpen={noticeOpen}
        noticePopoverId={noticePopoverId}
        onSearch={setSearch}
        onClearSearch={clearSearch}
        onSelectSearchResult={(result) => {
          clearSearch()
          onNavigate(result.view)
        }}
        onToggleNotices={onToggleNotices}
        onCloseNotices={onCloseNotices}
        onOpenProfile={onOpenProfile}
        onQuickAdd={onQuickAdd}
      />
      {noticeOpen ? (
        <div id={noticePopoverId} className="notice-popover" role="status">
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
                  onCreateTask={onCreateTask}
                  onCreateSubject={onCreateSubject}
                />
              ) : null}
              {activeView === 'Home' ? (
                <HomeView
                  notes={notes}
                  events={events}
                  tasks={tasks}
                  studySessions={studySessions}
                  subjectMap={subjectMap}
                  weeklyStudyDays={weeklyStudyDays}
                  quickNotes={quickNotes}
                  dailyGoalMinutes={dailyGoalMinutes}
                  databaseGeneration={databaseGeneration}
                  onboardingChecklistDismissed={onboardingChecklistDismissed}
                  todayFocusMinutes={todayFocusMinutes}
                  currentDate={currentDate}
                  activeSession={activeSession}
                  staleFocusSession={staleFocusSession}
                  staleFocusSubjectName={staleFocusSubjectName}
                  sessionLimitSeconds={sessionLimitSeconds}
                  sessionNotice={sessionNotice}
                  canStartFocus={canStartFocus}
                  focusTransitionPending={focusActionsPending}
                  subjects={subjects}
                  focusSubjectId={focusSubjectId}
                  focusDurationMinutes={focusDurationMinutes}
                  focusAttentionRequest={focusAttentionRequest}
                  onFocusSubjectChange={onFocusSubjectChange}
                  onFocusDurationChange={onFocusDurationChange}
                  onQuickNotesChange={addQuickNote}
                  onStartSession={onStartSession}
                  onPauseSession={onPauseSession}
                  onResumeSession={onResumeSession}
                  onStopSession={onStopSession}
                  onAcceptStaleFocusSession={onAcceptStaleFocusSession}
                  onDiscardStaleFocusSession={onDiscardStaleFocusSession}
                  onNavigate={onNavigate}
                  onCreateSubject={onCreateSubject}
                  onCreateTask={onCreateTask}
                  onRevealFocusSession={onRevealFocusSession}
                  onDismissOnboardingChecklist={onDismissOnboardingChecklist}
                />
              ) : null}
              {activeView === 'Tasks' ? (
                <TasksView
                  tasks={filteredTasks}
                  subjects={subjects}
                  filter={taskFilter}
                  openEditorRequest={taskEditorRequest}
                  onFilterChange={onTaskFilterChange}
                  search={deferredSearch}
                  onClearSearch={clearSearch}
                  databaseGeneration={databaseGeneration}
                />
              ) : null}
              {activeView === 'Notes' ? (
                <NotesView
                  notes={filteredNotes}
                  subjects={subjects}
                  subjectMap={subjectMap}
                  openEditorRequest={noteEditorRequest}
                  search={deferredSearch}
                  onClearSearch={clearSearch}
                  databaseGeneration={databaseGeneration}
                />
              ) : null}
              {activeView === 'Subjects' ? (
                <SubjectsView
                  subjects={filteredSubjects}
                  tasks={tasks}
                  notes={notes}
                  events={events}
                  sessions={studySessions}
                  currentDate={currentDate}
                  openEditorRequest={subjectEditorRequest}
                  databaseGeneration={databaseGeneration}
                />
              ) : null}
              {activeView === 'Calendar' ? (
                <CalendarView
                  events={filteredEvents}
                  subjects={subjects}
                  subjectMap={subjectMap}
                  openEditorRequest={eventEditorRequest}
                  search={deferredSearch}
                  onClearSearch={clearSearch}
                  databaseGeneration={databaseGeneration}
                />
              ) : null}
              {activeView === 'Progress' ? (
                <ProgressView
                  subjects={subjects}
                  tasks={tasks}
                  studySessions={studySessions}
                  weeklyStudyDays={weeklyStudyDays}
                  dailyGoalMinutes={dailyGoalMinutes}
                  todayFocusMinutes={todayFocusMinutes}
                  subjectMap={subjectMap}
                  currentDate={currentDate}
                  openEditorOnMount={progressEditorRequested}
                  databaseGeneration={databaseGeneration}
                />
              ) : null}
              {activeView === 'Goals' ? (
                <GoalsView
                  dailyGoalMinutes={dailyGoalMinutes}
                  studySessions={studySessions}
                  currentDate={currentDate}
                  databaseGeneration={databaseGeneration}
                />
              ) : null}
              {activeView === 'Settings' ? (
                <SettingsView
                  coordinatorState={coordinatorState}
                  onExport={onExport}
                  onImport={onImport}
                  onClear={onClear}
                  importPending={focusImportPending}
                  profileNotice={profileNotice}
                  preferenceNotice={preferenceNotice}
                  onDismissPreferenceNotice={onDismissPreferenceNotice}
                  theme={theme}
                  onThemeChange={onThemeChange}
                  onShowOnboardingChecklist={onShowOnboardingChecklist}
                />
              ) : null}
            </section>
            {activeView === 'Home' ? (
              <aside className="right-column" aria-label="Progress and schedule">
                <WeeklyProgress days={weeklyStudyDays} />
                <Upcoming events={upcomingEvents} subjectMap={subjectMap} onViewAll={() => onNavigate('Calendar')} />
                <StreakCard sessions={studySessions} now={currentDate} />
              </aside>
            ) : null}
          </div>
        )}
      </main>
    </>
  )
}
