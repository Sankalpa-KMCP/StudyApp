import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  buildSearchResults,
  getTodayFocusMinutes,
  getWeeklyStudyDays,
  isFlashcardDue,
  percent,
  startOfToday,
  formatMinutes,
} from './appUtils'
import {
  clearStudyData,
  createId,
  exportStudyData,
  getStudyData,
  importStudyData,
  migrateLegacyLocalStorage,
  nowIso,
  studyDb,
} from './db/studyDb'
import type { StudyData } from './db/types'
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
type TaskFilter = 'all' | 'open' | 'done'
export type SettingsFeedback = { tone: 'success' | 'error'; message: string }
export type ActiveSession = { subjectId: string; startedAt: string; startedAtMs: number; plannedMinutes: number }
export type ThemeMode = 'light' | 'dark' | 'aurora' | 'ember'

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

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'aurora' || value === 'ember'
}

function App() {
  const [activeView, setActiveView] = useState<View>('Home')
  const [search, setSearch] = useState('')
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all')
  const [taskEditorRequest, setTaskEditorRequest] = useState(0)
  const [subjectEditorRequest, setSubjectEditorRequest] = useState(0)
  const [profileNotice, setProfileNotice] = useState('')
  const [focusSubjectId, setFocusSubjectId] = useState('')
  const [focusDurationMinutes, setFocusDurationMinutes] = useState(25)
  const [sessionNotice, setSessionNotice] = useState('')
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const savedTheme = localStorage.getItem('study-dashboard-theme')
    return isThemeMode(savedTheme) ? savedTheme : 'light'
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('study-dashboard-sidebar') === 'collapsed')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [revealedCards, setRevealedCards] = useState<Set<string>>(() => new Set())
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)

  useEffect(() => {
    void migrateLegacyLocalStorage()
  }, [])

  const liveData = useLiveQuery(() => getStudyData(), [])
  const data = liveData ?? EMPTY_DATA
  const isLoading = liveData === undefined

  const dailyGoalMinutes = settingNumber(data, 'dailyGoalMinutes', 240)
  const quickNotes = settingStringArray(data, 'quickNotes')
  const subjectMap = useMemo(() => new Map(data.subjects.map((subject) => [subject.id, subject])), [data.subjects])
  const normalizedSearch = search.trim().toLowerCase()
  const todayFocusMinutes = getTodayFocusMinutes(data.studySessions)
  const weeklyStudyDays = getWeeklyStudyDays(data.studySessions)
  const completedTasks = data.tasks.filter((task) => task.status === 'done')
  const upcomingEvents = data.events.filter((event) => new Date(event.startAt).getTime() >= startOfToday()).slice(0, 4)
  const dueCards = data.flashcards.filter((card) => isFlashcardDue(card))
  const homeSearchResults = buildSearchResults(data, subjectMap, search)
  const elapsedSeconds = activeSession ? Math.max(0, Math.floor((nowMs - activeSession.startedAtMs) / 1000)) : 0
  const sessionLimitSeconds = activeSession && activeSession.plannedMinutes > 0 ? activeSession.plannedMinutes * 60 : 0

  useEffect(() => {
    if (!activeSession) return undefined
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [activeSession])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' || theme === 'aurora' ? '#101716' : '#f6f8f7')
    localStorage.setItem('study-dashboard-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('study-dashboard-sidebar', sidebarCollapsed ? 'collapsed' : 'expanded')
  }, [sidebarCollapsed])

  const filteredTasks = data.tasks.filter((task) => {
    const subject = subjectMap.get(task.subjectId)?.name ?? 'General'
    const matchesSearch = `${task.title} ${subject} ${task.priority}`.toLowerCase().includes(normalizedSearch)
    const matchesFilter = taskFilter === 'all' || task.status === taskFilter
    return matchesSearch && matchesFilter
  })

  const filteredNotes = data.notes.filter((note) => {
    const subject = subjectMap.get(note.subjectId)?.name ?? 'General'
    return `${note.title} ${note.body} ${subject} ${note.tags.join(' ')}`.toLowerCase().includes(normalizedSearch)
  })

  const filteredSubjects = data.subjects.filter((subject) => `${subject.name} ${subject.progress}`.toLowerCase().includes(normalizedSearch))
  const filteredEvents = data.events.filter((event) => {
    const subject = subjectMap.get(event.subjectId)?.name ?? 'General'
    return `${event.title} ${event.location} ${subject}`.toLowerCase().includes(normalizedSearch)
  })
  const filteredFlashcards = data.flashcards.filter((card) => {
    const subject = subjectMap.get(card.subjectId)?.name ?? 'General'
    return `${card.front} ${card.back} ${subject} ${card.status}`.toLowerCase().includes(normalizedSearch)
  }).sort((a, b) => Number(isFlashcardDue(b)) - Number(isFlashcardDue(a)))

  const addQuickNote = async (value: string) => {
    await studyDb.settings.put({ key: 'quickNotes', value: value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 8) })
  }

  const exportData = async () => {
    const payload = await exportStudyData()
    const serialized = JSON.stringify(payload, null, 2)
    const filename = `study-dashboard-${new Date().toISOString().slice(0, 10)}.json`
    const blob = new Blob([serialized], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const importData = async (file: File) => {
    await importStudyData(JSON.parse(await file.text()) as unknown)
  }

  const openNewTask = () => {
    setActiveView('Tasks')
    setTaskEditorRequest((request) => request + 1)
  }

  const openNewSubject = () => {
    setActiveView('Subjects')
    setSubjectEditorRequest((request) => request + 1)
  }

  const startSession = useCallback(() => {
    const startedAtMs = Date.now()
    setNowMs(startedAtMs)
    setActiveSession({
      subjectId: focusSubjectId,
      startedAt: nowIso(),
      startedAtMs,
      plannedMinutes: focusDurationMinutes,
    })
    setSessionNotice('')
  }, [focusDurationMinutes, focusSubjectId])

  const stopSession = useCallback(async (completed = false) => {
    if (!activeSession) return
    const endedAt = nowIso()
    const actualMinutes = Math.round((Date.now() - activeSession.startedAtMs) / 60_000)
    const minutes = Math.max(1, completed && activeSession.plannedMinutes > 0 ? activeSession.plannedMinutes : actualMinutes)
    await studyDb.studySessions.add({
      id: createId('session'),
      subjectId: activeSession.subjectId,
      startedAt: activeSession.startedAt,
      endedAt,
      minutes,
      note: completed ? 'Completed focus session' : activeSession.subjectId ? 'Focus session' : 'General focus session',
    })
    setActiveSession(null)
    setSessionNotice(completed ? `Session complete: ${formatMinutes(minutes)} logged.` : `Session stopped: ${formatMinutes(minutes)} logged.`)
  }, [activeSession])

  useEffect(() => {
    if (!activeSession || sessionLimitSeconds <= 0) return undefined
    const remainingMs = Math.max(0, sessionLimitSeconds * 1000 - (Date.now() - activeSession.startedAtMs))
    const timer = window.setTimeout(() => {
      void stopSession(true)
    }, remainingMs)
    return () => window.clearTimeout(timer)
  }, [activeSession, sessionLimitSeconds, stopSession])

  const updateFocusSubject = (subjectId: string) => {
    setFocusSubjectId(subjectId)
    setActiveSession((session) => session ? { ...session, subjectId } : session)
  }

  return (
    <div className={sidebarCollapsed ? 'app-shell is-sidebar-collapsed' : 'app-shell'}>
      <a className="skip-link" href="#dashboard-main">Skip to dashboard</a>
      <Sidebar
        activeView={activeView}
        collapsed={sidebarCollapsed}
        onNavigate={setActiveView}
        onToggleCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
      />
      <div className="workspace">
        <Topbar
          activeView={activeView}
          search={search}
          noticeOpen={noticeOpen}
          onSearch={setSearch}
          onClearSearch={() => setSearch('')}
          onToggleNotices={() => setNoticeOpen((open) => !open)}
          onOpenProfile={() => {
            setActiveView('Settings')
            setProfileNotice('Profile settings live in this local Settings workspace for now.')
          }}
        />
        {noticeOpen ? (
          <div className="notice-popover" role="status">
            <strong>{completedTasks.length} completed tasks</strong>
            <span>{Math.round(percent(todayFocusMinutes, dailyGoalMinutes))}% of today&apos;s focus target is done.</span>
          </div>
        ) : null}
        <main id="dashboard-main" className="dashboard" aria-label="Study dashboard">
          {isLoading ? (
            <section className="loading-panel" aria-live="polite">Loading your study space...</section>
          ) : (
            <div className="content-grid">
              <section className="primary-column" aria-label="Primary study summary">
                <HeroRow
                  activeView={activeView}
                  todayFocusMinutes={todayFocusMinutes}
                  dailyGoalMinutes={dailyGoalMinutes}
                  onCreateTask={openNewTask}
                  onCreateSubject={openNewSubject}
                />
                {activeView === 'Home' ? (
                  <HomeView
                    data={data}
                    subjectMap={subjectMap}
                    weeklyStudyDays={weeklyStudyDays}
                    quickNotes={quickNotes}
                    dailyGoalMinutes={dailyGoalMinutes}
                    todayFocusMinutes={todayFocusMinutes}
                    activeSession={activeSession}
                    elapsedSeconds={elapsedSeconds}
                    sessionLimitSeconds={sessionLimitSeconds}
                    sessionNotice={sessionNotice}
                    subjects={data.subjects}
                    focusSubjectId={focusSubjectId}
                    focusDurationMinutes={focusDurationMinutes}
                    search={search}
                    searchResults={homeSearchResults}
                    onFocusSubjectChange={updateFocusSubject}
                    onFocusDurationChange={setFocusDurationMinutes}
                    onQuickNotesChange={addQuickNote}
                    onStartSession={startSession}
                    onStopSession={stopSession}
                    onNavigate={setActiveView}
                  />
                ) : null}
                {activeView === 'Tasks' ? (
                  <TasksView tasks={filteredTasks} subjects={data.subjects} filter={taskFilter} openEditorRequest={taskEditorRequest} onFilterChange={setTaskFilter} search={search} onClearSearch={() => setSearch('')} />
                ) : null}
                {activeView === 'Notes' ? <NotesView notes={filteredNotes} subjects={data.subjects} subjectMap={subjectMap} search={search} onClearSearch={() => setSearch('')} /> : null}
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
                  <CalendarView events={filteredEvents} subjects={data.subjects} subjectMap={subjectMap} search={search} onClearSearch={() => setSearch('')} />
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
                    onLogSession={() => {
                      setActiveView('Home')
                      if (!activeSession) startSession()
                    }}
                  />
                ) : null}
                {activeView === 'Goals' ? (
                  <GoalsView
                    goals={data.goals}
                    dailyGoalMinutes={dailyGoalMinutes}
                    todayFocusMinutes={todayFocusMinutes}
                    weeklyStudyHours={weeklyStudyDays.reduce((sum, day) => sum + day.hours, 0)}
                  />
                ) : null}
                {activeView === 'Settings' ? (
                  <SettingsView
                    onExport={() => void exportData()}
                    onImport={importData}
                    onClear={clearStudyData}
                    onClearSearch={() => setSearch('')}
                    profileNotice={profileNotice}
                    theme={theme}
                    onThemeChange={setTheme}
                  />
                ) : null}
              </section>
              <aside className="right-column" aria-label="Progress and schedule">
                <WeeklyProgress days={weeklyStudyDays} />
                <Upcoming events={upcomingEvents} subjectMap={subjectMap} onViewAll={() => setActiveView('Calendar')} />
                <StreakCard sessions={data.studySessions} />
                <ReviewQueue count={dueCards.length} onOpen={() => setActiveView('Flashcards')} />
              </aside>
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
