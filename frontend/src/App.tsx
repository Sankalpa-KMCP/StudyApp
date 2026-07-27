import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CircleUserRound,
  Download,
  FileText,
  Home,
  Layers3,
  NotebookText,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Target,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react'
import {
  buildSearchResults,
  clamp,
  formatDate,
  formatDateTime,
  formatFlashcardDue,
  formatHours,
  formatMinutes,
  getGoalProgress,
  getSubjectProgress,
  getTodayFocusMinutes,
  getWeeklyStudyDays,
  isDerivedGoal,
  isFlashcardDue,
  nextFlashcardSchedule,
  parseTags,
  percent,
  startOfToday,
  todayInputValue,
  toInputDate,
  toInputTime,
  type WeeklyStudyDay,
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
import type {
  CalendarEvent,
  Flashcard,
  FlashcardStatus,
  GoalPeriod,
  StudyData,
  StudyGoal,
  StudyNote,
  StudySession,
  StudySubject,
  StudyTask,
} from './db/types'
import { EmptyState, PanelHeader, TextInput, NumberInput, SubjectSelect, EditorActions, RowActionButtons, MetricCard, ProgressBar } from './components/ui'
import { ReviewQueue, StreakCard, StudyTime, SubjectDistribution, Upcoming, WeeklyProgress } from './components/RightColumn'
import { HomeView } from './home/HomeView'
import { TasksView } from './views/TasksView'

export type View = 'Home' | 'Tasks' | 'Notes' | 'Subjects' | 'Calendar' | 'Flashcards' | 'Progress' | 'Goals' | 'Settings'
type TaskFilter = 'all' | 'open' | 'done'
type SettingsFeedback = { tone: 'success' | 'error'; message: string }
export type ActiveSession = { subjectId: string; startedAt: string; startedAtMs: number; plannedMinutes: number }
type ThemeMode = 'light' | 'dark' | 'aurora' | 'ember'

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

const navItems: Array<{ label: View; icon: typeof Home }> = [
  { label: 'Home', icon: Home },
  { label: 'Tasks', icon: Check },
  { label: 'Notes', icon: FileText },
  { label: 'Subjects', icon: BookOpen },
  { label: 'Calendar', icon: CalendarDays },
  { label: 'Flashcards', icon: NotebookText },
  { label: 'Progress', icon: TrendingUp },
  { label: 'Goals', icon: Target },
]

const colorSwatches = ['#111827', '#2563eb', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#475569', '#047857']
const todayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date())
const themeOptions: Array<{ id: ThemeMode; label: string; description: string; swatches: string[] }> = [
  { id: 'light', label: 'Dawn', description: 'Clean, bright, and calm.', swatches: ['#f6f8f7', '#126a5a', '#c44924'] },
  { id: 'dark', label: 'Night', description: 'Low glare for deep focus.', swatches: ['#0e1111', '#5ee0c2', '#ff9069'] },
  { id: 'aurora', label: 'Aurora', description: 'Cool energy with a premium glow.', swatches: ['#08111f', '#7dd3fc', '#c084fc'] },
  { id: 'ember', label: 'Ember', description: 'Warm editorial study desk.', swatches: ['#fff4e8', '#9a3412', '#2563eb'] },
]

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
    try {
      const [{ save }, { writeTextFile }] = await Promise.all([import('@tauri-apps/plugin-dialog'), import('@tauri-apps/plugin-fs')])
      const path = await save({ defaultPath: filename, filters: [{ name: 'Study Dashboard export', extensions: ['json'] }] })
      if (path) {
        await writeTextFile(path, serialized)
        return
      }
    } catch {
      // Browser fallback below.
    }
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

  const importNativeData = async () => {
    const [{ open }, { readTextFile }] = await Promise.all([import('@tauri-apps/plugin-dialog'), import('@tauri-apps/plugin-fs')])
    const path = await open({ multiple: false, filters: [{ name: 'Study Dashboard export', extensions: ['json'] }] })
    if (typeof path !== 'string') return false
    await importStudyData(JSON.parse(await readTextFile(path)) as unknown)
    return true
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

  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined

    void import('@tauri-apps/api/event')
      .then(({ listen }) => listen('desktop-timer-toggle', () => {
        if (activeSession) void stopSession()
        else startSession()
      }))
      .then((cleanup) => {
        if (disposed) cleanup()
        else unlisten = cleanup
      })
      .catch(() => undefined)

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [activeSession, startSession, stopSession])

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
                  <TasksView tasks={filteredTasks} subjects={data.subjects} filter={taskFilter} openEditorRequest={taskEditorRequest} onFilterChange={setTaskFilter} />
                ) : null}
                {activeView === 'Notes' ? <NotesView notes={filteredNotes} subjects={data.subjects} subjectMap={subjectMap} /> : null}
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
                  <CalendarView events={filteredEvents} subjects={data.subjects} subjectMap={subjectMap} />
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
                    onNativeImport={importNativeData}
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

function Sidebar({
  activeView,
  collapsed,
  onNavigate,
  onToggleCollapsed,
}: {
  activeView: View
  collapsed: boolean
  onNavigate: (view: View) => void
  onToggleCollapsed: () => void
}) {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="brand-row">
        <button className="brand-dot" type="button" aria-label="Go to dashboard" onClick={() => onNavigate('Home')}>
          <img src="/brand-mark.svg" alt="" />
        </button>
        <div className="brand-copy">
          <strong>Study</strong>
          <span>Command center</span>
        </div>
        <button className="sidebar-toggle" type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-pressed={collapsed} onClick={onToggleCollapsed}>
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
        </button>
      </div>
      <nav>
        {navItems.map(({ label, icon: Icon }) => (
          <button className={activeView === label ? 'nav-item is-active' : 'nav-item'} type="button" key={label} onClick={() => onNavigate(label)}>
            <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className={activeView === 'Settings' ? 'nav-item is-active' : 'nav-item'} type="button" onClick={() => onNavigate('Settings')}>
          <Settings size={21} strokeWidth={1.8} aria-hidden="true" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  )
}

function Topbar(props: {
  activeView: View
  search: string
  noticeOpen: boolean
  onSearch: (value: string) => void
  onClearSearch: () => void
  onToggleNotices: () => void
  onOpenProfile: () => void
}) {
  return (
    <header className="topbar">
      <h2>{props.activeView === 'Home' ? 'Dashboard' : props.activeView}</h2>
      <div className="topbar-actions">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search</span>
          <input value={props.search} placeholder="Search" onChange={(event) => props.onSearch(event.target.value)} />
          {props.search ? (
            <button className="clear-button" type="button" aria-label="Clear search" onClick={props.onClearSearch}>
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </label>
        <button className={props.noticeOpen ? 'icon-button is-active' : 'icon-button'} type="button" aria-label="Notifications" onClick={props.onToggleNotices}>
          <Bell size={20} aria-hidden="true" />
        </button>
        <button className="avatar-button" type="button" aria-label="Profile" onClick={props.onOpenProfile}>
          <CircleUserRound size={21} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}

function HeroRow(props: {
  activeView: View
  todayFocusMinutes: number
  dailyGoalMinutes: number
  onCreateTask: () => void
  onCreateSubject: () => void
}) {
  return (
    <section className="hero-row" aria-label="Today overview">
      <div className="hero-copy">
        <span className="eyebrow">{todayLabel}</span>
        <h1>Good morning</h1>
        <p>{props.activeView === 'Home' ? 'Build today from real study data, saved offline on this device.' : `Working in ${props.activeView}.`}</p>
      </div>
      <div className="hero-metrics" aria-label="Today focus summary">
        <span>
          <strong>{formatMinutes(props.todayFocusMinutes)}</strong>
          logged today
        </span>
        <span>
          <strong>{Math.round(percent(props.todayFocusMinutes, props.dailyGoalMinutes))}%</strong>
          daily target
        </span>
      </div>
      <div className="hero-actions">
        <button className="secondary-command" type="button" onClick={props.onCreateSubject}>
          <BookOpen size={17} aria-hidden="true" />
          Subject
        </button>
        <button className="primary-command" type="button" onClick={props.onCreateTask}>
          <Plus size={17} aria-hidden="true" />
          Task
        </button>
      </div>
      <div className="date-stack">
        <strong>{formatMinutes(props.dailyGoalMinutes)}</strong>
        <span>daily goal</span>
      </div>
    </section>
  )
}

function NotesView({ notes, subjects, subjectMap }: { notes: StudyNote[]; subjects: StudySubject[]; subjectMap: Map<string, StudySubject> }) {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ title: '', body: '', subjectId: '', tags: '' })

  const openEditor = (note?: StudyNote) => {
    setEditingNoteId(note?.id ?? 'new')
    setDraft({
      title: note?.title ?? '',
      body: note?.body ?? '',
      subjectId: note?.subjectId ?? subjects[0]?.id ?? '',
      tags: note?.tags.join(', ') ?? '',
    })
  }

  const saveNote = async () => {
    const title = draft.title.trim()
    if (!title) return
    const timestamp = nowIso()
    const payload = {
      title,
      body: draft.body.trim(),
      subjectId: draft.subjectId,
      tags: parseTags(draft.tags),
      updatedAt: timestamp,
    }
    if (editingNoteId && editingNoteId !== 'new') await studyDb.notes.update(editingNoteId, payload)
    else await studyDb.notes.add({ id: createId('note'), ...payload, createdAt: timestamp })
    setEditingNoteId(null)
    setDraft({ title: '', body: '', subjectId: subjects[0]?.id ?? '', tags: '' })
  }

  return (
    <section className="workspace-panel" aria-labelledby="notes-workspace-title">
      <PanelHeader title="Notes" actionLabel="New note" onAction={() => openEditor()} />
      {editingNoteId ? (
        <div className="editor-card note-editor">
          <TextInput label="Note title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
          <SubjectSelect subjects={subjects} value={draft.subjectId} onChange={(subjectId) => setDraft({ ...draft, subjectId })} />
          <TextInput label="Tags" value={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} />
          <label className="field field-full">
            <span>Body</span>
            <textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} rows={6} />
          </label>
          <EditorActions onSave={() => void saveNote()} onCancel={() => setEditingNoteId(null)} />
        </div>
      ) : null}
      {notes.length > 0 ? (
        <div className="card-grid">
          {notes.map((note) => (
            <article className="detail-card note-detail" key={note.id}>
              <div>
                <span className="pill">{subjectMap.get(note.subjectId)?.name ?? 'General'}</span>
                <h3>{note.title}</h3>
                <p>{note.body || 'No body yet.'}</p>
                <time>{formatDate(note.updatedAt)}</time>
              </div>
              <RowActionButtons label={note.title} onEdit={() => openEditor(note)} onDelete={() => void studyDb.notes.delete(note.id)} />
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={FileText} title="No notes yet" body="Capture summaries, formulas, and review prompts in your local database." actionLabel="Create first note" onAction={() => openEditor()} />
      )}
    </section>
  )
}

function SubjectsView({
  subjects,
  tasks,
  notes,
  events,
  flashcards,
  sessions,
  openEditorRequest,
}: {
  subjects: StudySubject[]
  tasks: StudyTask[]
  notes: StudyNote[]
  events: CalendarEvent[]
  flashcards: Flashcard[]
  sessions: StudySession[]
  openEditorRequest: number
}) {
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ name: '', color: colorSwatches[0], targetHours: 5, progress: 0 })
  const [feedback, setFeedback] = useState<SettingsFeedback | null>(null)
  const handledEditorRequest = useRef(0)

  const openEditor = useCallback((subject?: StudySubject) => {
    setEditingSubjectId(subject?.id ?? 'new')
    setDraft({
      name: subject?.name ?? '',
      color: subject?.color ?? colorSwatches[0],
      targetHours: subject?.targetHours ?? 5,
      progress: subject?.progress ?? 0,
    })
  }, [])

  useEffect(() => {
    if (openEditorRequest > handledEditorRequest.current) {
      handledEditorRequest.current = openEditorRequest
      openEditor()
    }
  }, [openEditor, openEditorRequest])

  const saveSubject = async () => {
    const name = draft.name.trim()
    if (!name) return
    const timestamp = nowIso()
    const payload = { ...draft, name, targetHours: clamp(draft.targetHours, 1, 100), progress: clamp(draft.progress, 0, 100), updatedAt: timestamp }
    if (editingSubjectId && editingSubjectId !== 'new') await studyDb.subjects.update(editingSubjectId, payload)
    else await studyDb.subjects.add({ id: createId('subject'), ...payload, createdAt: timestamp })
    setEditingSubjectId(null)
    setDraft({ name: '', color: colorSwatches[0], targetHours: 5, progress: 0 })
    setFeedback(null)
  }

  const getLinkedCounts = (subjectId: string) => ({
    tasks: tasks.filter((task) => task.subjectId === subjectId).length,
    notes: notes.filter((note) => note.subjectId === subjectId).length,
    events: events.filter((event) => event.subjectId === subjectId).length,
    flashcards: flashcards.filter((card) => card.subjectId === subjectId).length,
    sessions: sessions.filter((session) => session.subjectId === subjectId).length,
  })

  const deleteSubject = async (subject: StudySubject) => {
    const linked = getLinkedCounts(subject.id)
    const linkedTotal = Object.values(linked).reduce((sum, count) => sum + count, 0)
    if (linkedTotal > 0) {
      setFeedback({
        tone: 'error',
        message: `Cannot delete ${subject.name}. It is linked to ${linked.tasks} tasks, ${linked.notes} notes, ${linked.events} events, ${linked.flashcards} flashcards, and ${linked.sessions} sessions.`,
      })
      return
    }
    if (!window.confirm(`Delete ${subject.name}? This subject has no linked records.`)) return
    await studyDb.subjects.delete(subject.id)
    setFeedback({ tone: 'success', message: `${subject.name} deleted.` })
  }

  return (
    <section className="workspace-panel" aria-labelledby="subjects-workspace-title">
      <PanelHeader title="Subjects" actionLabel="New subject" onAction={() => openEditor()} />
      {feedback ? <p className={`settings-feedback ${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p> : null}
      {editingSubjectId ? (
        <div className="editor-card">
          <TextInput label="Subject name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
          <label className="field">
            <span>Color</span>
            <div className="swatch-row">
              {colorSwatches.map((color) => (
                <button
                  className={draft.color === color ? 'swatch is-active' : 'swatch'}
                  style={{ backgroundColor: color }}
                  type="button"
                  key={color}
                  aria-label={`Use ${color}`}
                  onClick={() => setDraft({ ...draft, color })}
                />
              ))}
            </div>
          </label>
          <NumberInput label="Target hours" value={draft.targetHours} min={1} max={100} onChange={(targetHours) => setDraft({ ...draft, targetHours })} />
          <NumberInput label="Progress %" value={draft.progress} min={0} max={100} onChange={(progress) => setDraft({ ...draft, progress })} />
          <EditorActions onSave={() => void saveSubject()} onCancel={() => setEditingSubjectId(null)} />
        </div>
      ) : null}
      {subjects.length > 0 ? (
        <div className="subject-grid">
          {subjects.map((subject) => {
            const taskCount = tasks.filter((task) => task.subjectId === subject.id).length
            const linked = getLinkedCounts(subject.id)
            const linkedTotal = Object.values(linked).reduce((sum, count) => sum + count, 0)
            const progressValue = getSubjectProgress(subject, sessions)
            const minutes = sessions.filter((session) => session.subjectId === subject.id).reduce((sum, session) => sum + session.minutes, 0)
            return (
              <article className="card subject-card editable-subject" style={{ '--subject-color': subject.color } as React.CSSProperties} key={subject.id}>
                <div className="subject-icon" style={{ backgroundColor: subject.color }}>
                  <BookOpen size={21} aria-hidden="true" />
                </div>
                <h3>{subject.name}</h3>
                <p>{subject.targetHours}h target</p>
                <ProgressBar value={progressValue} label={`${Math.round(progressValue)}%`} />
                <p>{taskCount} tasks - {formatMinutes(minutes)} logged</p>
                {linkedTotal > 0 ? <small className="muted-copy">{linkedTotal} linked records must be moved or deleted first.</small> : null}
                <RowActionButtons label={subject.name} onEdit={() => openEditor(subject)} onDelete={() => void deleteSubject(subject)} />
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={BookOpen} title="No subjects yet" body="Create subjects first, then connect tasks, notes, events, and cards." actionLabel="Create first subject" onAction={() => openEditor()} />
      )}
    </section>
  )
}

function CalendarView({ events, subjects, subjectMap }: { events: CalendarEvent[]; subjects: StudySubject[]; subjectMap: Map<string, StudySubject> }) {
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ title: '', subjectId: '', date: todayInputValue(), time: '09:00', duration: 60, location: '' })

  const openEditor = (event?: CalendarEvent) => {
    const start = event ? new Date(event.startAt) : new Date()
    const end = event ? new Date(event.endAt) : new Date(start.getTime() + 60 * 60_000)
    setEditingEventId(event?.id ?? 'new')
    setDraft({
      title: event?.title ?? '',
      subjectId: event?.subjectId ?? subjects[0]?.id ?? '',
      date: toInputDate(start),
      time: toInputTime(start),
      duration: Math.max(15, Math.round((end.getTime() - start.getTime()) / 60_000)),
      location: event?.location ?? '',
    })
  }

  const saveEvent = async () => {
    const title = draft.title.trim()
    if (!title) return
    const timestamp = nowIso()
    const startAt = new Date(`${draft.date}T${draft.time}`).toISOString()
    const payload = {
      title,
      subjectId: draft.subjectId,
      startAt,
      endAt: new Date(new Date(startAt).getTime() + draft.duration * 60_000).toISOString(),
      location: draft.location.trim(),
      updatedAt: timestamp,
    }
    if (editingEventId && editingEventId !== 'new') await studyDb.events.update(editingEventId, payload)
    else await studyDb.events.add({ id: createId('event'), ...payload, createdAt: timestamp })
    setEditingEventId(null)
  }

  return (
    <section className="workspace-panel" aria-labelledby="calendar-workspace-title">
      <PanelHeader title="Calendar" actionLabel="New event" onAction={() => openEditor()} />
      <CalendarStrip events={events} />
      {editingEventId ? (
        <div className="editor-card">
          <TextInput label="Event title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
          <SubjectSelect subjects={subjects} value={draft.subjectId} onChange={(subjectId) => setDraft({ ...draft, subjectId })} />
          <TextInput label="Date" type="date" value={draft.date} onChange={(date) => setDraft({ ...draft, date })} />
          <TextInput label="Time" type="time" value={draft.time} onChange={(time) => setDraft({ ...draft, time })} />
          <NumberInput label="Duration" value={draft.duration} min={15} max={480} onChange={(duration) => setDraft({ ...draft, duration })} />
          <TextInput label="Location" value={draft.location} onChange={(location) => setDraft({ ...draft, location })} />
          <EditorActions onSave={() => void saveEvent()} onCancel={() => setEditingEventId(null)} />
        </div>
      ) : null}
      {events.length > 0 ? (
        <div className="table-list">
          {events.map((event) => (
            <article className="list-row" key={event.id}>
              <time>{formatDateTime(event.startAt)}</time>
              <div>
                <h3>{event.title}</h3>
                <p>{subjectMap.get(event.subjectId)?.name ?? 'General'}{event.location ? ` - ${event.location}` : ''}</p>
              </div>
              <RowActionButtons label={event.title} onEdit={() => openEditor(event)} onDelete={() => void studyDb.events.delete(event.id)} />
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={CalendarDays} title="No events scheduled" body="Plan classes, study groups, reviews, and exam blocks." actionLabel="Create first event" onAction={() => openEditor()} />
      )}
    </section>
  )
}

function FlashcardsView(props: {
  cards: Flashcard[]
  subjects: StudySubject[]
  subjectMap: Map<string, StudySubject>
  revealedCards: Set<string>
  onToggleReveal: (id: string) => void
}) {
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ front: '', back: '', subjectId: '' })

  const openEditor = (card?: Flashcard) => {
    setEditingCardId(card?.id ?? 'new')
    setDraft({ front: card?.front ?? '', back: card?.back ?? '', subjectId: card?.subjectId ?? props.subjects[0]?.id ?? '' })
  }

  const saveCard = async () => {
    const front = draft.front.trim()
    const back = draft.back.trim()
    if (!front || !back) return
    const timestamp = nowIso()
    const payload = { front, back, subjectId: draft.subjectId, updatedAt: timestamp }
    if (editingCardId && editingCardId !== 'new') await studyDb.flashcards.update(editingCardId, payload)
    else await studyDb.flashcards.add({ id: createId('card'), ...payload, status: 'new', lastReviewedAt: '', dueAt: timestamp, intervalDays: 0, reviewCount: 0, createdAt: timestamp })
    setEditingCardId(null)
    setDraft({ front: '', back: '', subjectId: props.subjects[0]?.id ?? '' })
  }

  return (
    <section className="workspace-panel" aria-labelledby="flashcards-workspace-title">
      <PanelHeader title="Flashcards" actionLabel="New card" onAction={() => openEditor()} />
      {editingCardId ? (
        <div className="editor-card">
          <TextInput label="Front" value={draft.front} onChange={(front) => setDraft({ ...draft, front })} />
          <TextInput label="Back" value={draft.back} onChange={(back) => setDraft({ ...draft, back })} />
          <SubjectSelect subjects={props.subjects} value={draft.subjectId} onChange={(subjectId) => setDraft({ ...draft, subjectId })} />
          <EditorActions onSave={() => void saveCard()} onCancel={() => setEditingCardId(null)} />
        </div>
      ) : null}
      {props.cards.length > 0 ? (
        <div className="card-grid">
          {props.cards.map((card) => (
            <article className="detail-card flashcard" key={card.id}>
              <span className={`status-badge ${card.status}`}>{card.status}</span>
              <h3>{card.front}</h3>
              <p>{props.revealedCards.has(card.id) ? card.back : 'Answer hidden'}</p>
              <span className="pill">{props.subjectMap.get(card.subjectId)?.name ?? 'General'}</span>
              <small className={isFlashcardDue(card) ? 'due-copy is-due' : 'due-copy'}>{formatFlashcardDue(card)} - reviewed {card.reviewCount ?? 0} times</small>
              <div className="button-row">
                <button className="secondary-command" type="button" onClick={() => props.onToggleReveal(card.id)}>
                  {props.revealedCards.has(card.id) ? 'Hide' : 'Reveal'}
                </button>
                <button className="secondary-command" type="button" onClick={() => void reviewCard(card, 'learning')}>Later</button>
                <button className="primary-command" type="button" onClick={() => void reviewCard(card, 'remembered')}>Remembered</button>
              </div>
              <RowActionButtons label={card.front} onEdit={() => openEditor(card)} onDelete={() => void studyDb.flashcards.delete(card.id)} />
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={NotebookText} title="No flashcards yet" body="Create prompt-and-answer cards, then review them from this queue." actionLabel="Create first card" onAction={() => openEditor()} />
      )}
    </section>
  )
}

function ProgressView(props: {
  data: StudyData
  weeklyStudyDays: WeeklyStudyDay[]
  dailyGoalMinutes: number
  todayFocusMinutes: number
  subjectMap: Map<string, StudySubject>
  onLogSession: () => void
}) {
  const completed = props.data.tasks.filter((task) => task.status === 'done').length
  const weeklyHours = props.weeklyStudyDays.reduce((sum, day) => sum + day.hours, 0)
  return (
    <section className="workspace-panel" aria-labelledby="progress-workspace-title">
      <PanelHeader title="Progress" actionLabel="Log session" onAction={props.onLogSession} />
      <div className="metric-grid">
        <MetricCard label="Weekly study" value={formatHours(weeklyHours)} />
        <MetricCard label="Tasks complete" value={`${completed}/${props.data.tasks.length}`} />
        <MetricCard label="Focus target" value={`${Math.round(percent(props.todayFocusMinutes, props.dailyGoalMinutes))}%`} />
        <MetricCard label="Cards remembered" value={`${props.data.flashcards.filter((card) => card.status === 'remembered').length}`} />
      </div>
      <StudyTime days={props.weeklyStudyDays} />
      <SubjectDistribution subjects={props.data.subjects} sessions={props.data.studySessions} subjectMap={props.subjectMap} />
    </section>
  )
}

function GoalsView({
  goals,
  dailyGoalMinutes,
  todayFocusMinutes,
  weeklyStudyHours,
}: {
  goals: StudyGoal[]
  dailyGoalMinutes: number
  todayFocusMinutes: number
  weeklyStudyHours: number
}) {
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ title: '', target: dailyGoalMinutes, progress: 0, period: 'daily' as GoalPeriod })

  const openEditor = (goal?: StudyGoal) => {
    setEditingGoalId(goal?.id ?? 'new')
    setDraft({ title: goal?.title ?? '', target: goal?.target ?? dailyGoalMinutes, progress: goal?.progress ?? 0, period: goal?.period ?? 'daily' })
  }

  const saveGoal = async () => {
    const title = draft.title.trim()
    if (!title) return
    const timestamp = nowIso()
    const payload = { ...draft, title, target: clamp(draft.target, 1, 10_000), progress: clamp(draft.progress, 0, draft.target), updatedAt: timestamp }
    if (editingGoalId && editingGoalId !== 'new') await studyDb.goals.update(editingGoalId, payload)
    else await studyDb.goals.add({ id: createId('goal'), ...payload, createdAt: timestamp })
    if (draft.period === 'daily' && title.toLowerCase().includes('focus')) await studyDb.settings.put({ key: 'dailyGoalMinutes', value: draft.target })
    setEditingGoalId(null)
  }

  return (
    <section className="workspace-panel" aria-labelledby="goals-workspace-title">
      <PanelHeader title="Goals" actionLabel="New goal" onAction={() => openEditor()} />
      {editingGoalId ? (
        <div className="editor-card">
          <TextInput label="Goal title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
          <NumberInput label="Target" value={draft.target} min={1} max={10_000} onChange={(target) => setDraft({ ...draft, target })} />
          <NumberInput label="Progress" value={draft.progress} min={0} max={10_000} onChange={(progress) => setDraft({ ...draft, progress })} />
          <label className="field">
            <span>Period</span>
            <select value={draft.period} onChange={(event) => setDraft({ ...draft, period: event.target.value as GoalPeriod })}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <EditorActions onSave={() => void saveGoal()} onCancel={() => setEditingGoalId(null)} />
        </div>
      ) : null}
      {goals.length > 0 ? (
        <div className="card-grid">
          {goals.map((goal) => {
            const progress = getGoalProgress(goal, todayFocusMinutes, weeklyStudyHours)
            return (
              <article className="detail-card" key={goal.id}>
                <span className="pill">{isDerivedGoal(goal) ? `${goal.period} - derived` : goal.period}</span>
                <h3>{goal.title}</h3>
                <ProgressBar value={percent(progress, goal.target)} label={`${progress}/${goal.target}`} />
                <RowActionButtons label={goal.title} onEdit={() => openEditor(goal)} onDelete={() => void studyDb.goals.delete(goal.id)} />
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={Target} title="No goals yet" body="Set focus, review, or weekly study goals and track progress here." actionLabel="Create first goal" onAction={() => openEditor()} />
      )}
    </section>
  )
}

function SettingsView({
  onExport,
  onImport,
  onClear,
  onClearSearch,
  profileNotice,
  theme,
  onThemeChange,
  onNativeImport,
}: {
  onExport: () => void
  onImport: (file: File) => Promise<void>
  onClear: () => Promise<void>
  onClearSearch: () => void
  profileNotice: string
  theme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
  onNativeImport: () => Promise<boolean>
}) {
  const [feedback, setFeedback] = useState<SettingsFeedback | null>(null)

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      await onImport(file)
      setFeedback({ tone: 'success', message: 'Study data imported.' })
    } catch {
      setFeedback({ tone: 'error', message: 'Import failed. Choose a valid Study Dashboard export.' })
    } finally {
      event.target.value = ''
    }
  }

  const handleClear = async () => {
    if (!window.confirm('Clear all study data? This cannot be undone.')) return

    try {
      await onClear()
      setFeedback({ tone: 'success', message: 'Study data cleared.' })
    } catch {
      setFeedback({ tone: 'error', message: 'Could not clear study data. Try again.' })
    }
  }

  const handleNativeImport = async () => {
    try {
      const imported = await onNativeImport()
      if (imported) setFeedback({ tone: 'success', message: 'Study data imported.' })
    } catch {
      setFeedback({ tone: 'error', message: 'Native import failed. Choose a valid Study Dashboard export.' })
    }
  }

  return (
    <section className="workspace-panel" aria-labelledby="settings-workspace-title">
      <PanelHeader title="Settings" actionLabel="Clear search" onAction={onClearSearch} />
      {profileNotice ? <p className="settings-feedback" role="status">{profileNotice}</p> : null}
      {feedback ? (
        <p className={`settings-feedback ${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'} aria-live="polite">
          {feedback.message}
        </p>
      ) : null}
      <div className="card-grid">
        <button className="action-card" type="button" onClick={onExport}>
          <Download size={24} aria-hidden="true" />
          <strong>Export data</strong>
          <span>Download or save an IndexedDB-backed JSON snapshot.</span>
        </button>
        <label className="action-card import-card">
          <Upload size={24} aria-hidden="true" />
          <strong>Import data</strong>
          <span>Restore a previously exported study snapshot.</span>
          <input className="sr-only" type="file" accept="application/json" onChange={(event) => void handleImport(event)} />
        </label>
        <button className="action-card" type="button" onClick={() => void handleNativeImport()}>
          <Upload size={24} aria-hidden="true" />
          <strong>Native import</strong>
          <span>Open a JSON export through the desktop file picker when running in Tauri.</span>
        </button>
        <button className="action-card" type="button" onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}>
          <CircleUserRound size={24} aria-hidden="true" />
          <strong>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</strong>
          <span>Switch the local visual theme for this device.</span>
        </button>
        <div className="action-card theme-card">
          <Layers3 size={24} aria-hidden="true" />
          <strong>Theme Studio</strong>
          <span>Choose a production palette for the whole workspace.</span>
          <div className="theme-grid" role="radiogroup" aria-label="Theme">
            {themeOptions.map((option) => (
              <button
                className={theme === option.id ? 'theme-option is-active' : 'theme-option'}
                type="button"
                role="radio"
                aria-checked={theme === option.id}
                key={option.id}
                onClick={() => onThemeChange(option.id)}
              >
                <span className="theme-swatches" aria-hidden="true">
                  {option.swatches.map((swatch) => <i style={{ backgroundColor: swatch }} key={swatch} />)}
                </span>
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
        <button className="action-card danger-card" type="button" onClick={() => void handleClear()}>
          <RotateCcw size={24} aria-hidden="true" />
          <strong>Clear all data</strong>
          <span>Remove tasks, notes, subjects, events, cards, sessions, and goals.</span>
        </button>
      </div>
    </section>
  )
}

function CalendarStrip({ events }: { events: CalendarEvent[] }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() + index)
    const key = date.toISOString().slice(0, 10)
    return {
      key,
      day: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date),
      date: date.getDate(),
      count: events.filter((event) => event.startAt.slice(0, 10) === key).length,
    }
  })

  return (
    <div className="calendar-strip" aria-label="Seven day calendar">
      {days.map((day) => (
        <article className={day.count > 0 ? 'calendar-day has-events' : 'calendar-day'} key={day.key}>
          <span>{day.day}</span>
          <strong>{day.date}</strong>
          <small>{day.count} events</small>
        </article>
      ))}
    </div>
  )
}

async function reviewCard(card: Flashcard, status: FlashcardStatus) {
  const reviewedAt = nowIso()
  await studyDb.flashcards.update(card.id, { status, lastReviewedAt: reviewedAt, updatedAt: reviewedAt, ...nextFlashcardSchedule(card, status === 'remembered' ? 'remembered' : 'learning', new Date(reviewedAt)) })
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
