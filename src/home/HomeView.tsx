import { BookOpen, CalendarDays, Check, Clock3, FileText, Flame, NotebookText, Pause, Play, Square, StopCircle, Target } from '../components/icons'
import {
  calculateStreak,
  calculateSubjectProgress,
  formatDate,
  formatDateTime,
  formatElapsed,
  formatHours,
  formatMinutes,
  isFlashcardDue,
  percent,
  type WeeklyStudyDay,
} from '../appUtils'
import type { ActiveFocusSession, CalendarEvent, Flashcard, StudyNote, StudySession, StudySubject, StudyTask } from '../db/types'
import { EmptyState, SubjectCard } from '../components/ui'
import { StudyTime } from '../components/RightColumn'
import type { View } from '../navigation/viewRoutes'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FirstStudyChecklist } from './FirstStudyChecklist'
import { getActiveFocusElapsedMs } from '../db/activeFocusSession'
import {
  getOpenOverdueTasks,
  getOpenTasksDueToday,
  getTodaysEvents,
} from './dashboardDateHelpers'
import {
  getRecommendedNextAction,
  type RecommendedNextAction,
} from './recommendedNextAction'
import { HOME_FOCUS_SESSION_ID, revealHomeFocusSession } from './revealHomeFocusSession'

export { HOME_FOCUS_SESSION_ID } from './revealHomeFocusSession'

export function HomeView(props: {
  notes: StudyNote[]
  events: CalendarEvent[]
  flashcards: Flashcard[]
  tasks: StudyTask[]
  studySessions: StudySession[]
  subjectMap: Map<string, StudySubject>
  weeklyStudyDays: WeeklyStudyDay[]
  quickNotes: string[]
  dailyGoalMinutes: number
  todayFocusMinutes: number
  currentDate: Date
  activeSession: ActiveFocusSession | null
  staleFocusSession: ActiveFocusSession | null
  staleFocusSubjectName: string
  sessionLimitSeconds: number
  sessionNotice: string
  canStartFocus: boolean
  focusTransitionPending: boolean
  subjects: StudySubject[]
  focusSubjectId: string
  focusDurationMinutes: number
  focusAttentionRequest?: number
  onFocusSubjectChange: (subjectId: string) => void
  onFocusDurationChange: (minutes: number) => void
  onQuickNotesChange: (value: string) => Promise<void>
  onStartSession: () => void
  onPauseSession: () => void
  onResumeSession: () => void
  onStopSession: () => Promise<void>
  onAcceptStaleFocusSession: () => void
  onDiscardStaleFocusSession: () => void
  onNavigate: (view: View) => void
  onCreateSubject: () => void
  onCreatePlan: () => void
  onLogSession: () => void
}) {
  const focusAttentionRequest = props.focusAttentionRequest ?? 0
  const handledFocusAttention = useRef(0)

  useLayoutEffect(() => {
    if (focusAttentionRequest <= handledFocusAttention.current) return
    // Idle Start is disabled until focus restore finishes — wait so we do not park focus on the card.
    const waitingForIdleStart =
      !props.activeSession
      && !props.staleFocusSession
      && (props.focusTransitionPending || !props.canStartFocus)
    if (waitingForIdleStart) return

    handledFocusAttention.current = focusAttentionRequest
    revealHomeFocusSession()
  }, [
    focusAttentionRequest,
    props.activeSession,
    props.staleFocusSession,
    props.focusTransitionPending,
    props.canStartFocus,
  ])

  const now = props.currentDate
  const dueTodayTasks = getOpenTasksDueToday(props.tasks, now)
  const overdueTasks = getOpenOverdueTasks(props.tasks, now)
  const todaysEvents = getTodaysEvents(props.events, now)
  const dueFlashcards = props.flashcards.filter((card) => isFlashcardDue(card))
  const streakDays = calculateStreak(props.studySessions, now)
  const weekHours = props.weeklyStudyDays.reduce((sum, day) => sum + day.hours, 0)
  const recommended = getRecommendedNextAction({
    tasks: props.tasks,
    flashcards: props.flashcards,
    events: props.events,
    subjects: props.subjects,
    activeSession: props.activeSession,
    todayFocusMinutes: props.todayFocusMinutes,
    dailyGoalMinutes: props.dailyGoalMinutes,
    now,
  })

  const openTasks = props.tasks.filter((task) => task.status === 'open').slice(0, 5)
  const recentNotes = props.notes.slice(0, 3)
  const subjectStats = props.subjects.slice(0, 5)

  const activateRecommended = () => {
    activateRecommendedNextAction(recommended, {
      onNavigate: props.onNavigate,
      onCreateSubject: props.onCreateSubject,
    })
  }

  return (
    <>
      <FirstStudyChecklist
        hasSubject={props.subjects.length > 0}
        hasPlan={props.tasks.length > 0 || props.events.length > 0}
        hasSession={props.studySessions.length > 0}
        onCreateSubject={props.onCreateSubject}
        onCreatePlan={props.onCreatePlan}
        onLogSession={props.onLogSession}
      />
      <HomeTodayDashboard
        dueTodayCount={dueTodayTasks.length}
        overdueCount={overdueTasks.length}
        dueFlashcardCount={dueFlashcards.length}
        todayEventCount={todaysEvents.length}
        streakDays={streakDays}
        weekHours={weekHours}
        todayFocusMinutes={props.todayFocusMinutes}
        dailyGoalMinutes={props.dailyGoalMinutes}
        overduePreview={overdueTasks.slice(0, 2)}
        todayEventPreview={todaysEvents.slice(0, 2)}
        recommended={recommended}
        onActivateRecommended={activateRecommended}
        onOpenTasks={() => props.onNavigate('Tasks')}
        onOpenFlashcards={() => props.onNavigate('Flashcards')}
        onOpenCalendar={() => props.onNavigate('Calendar')}
      />
      <div className="summary-grid">
        <TaskCard
          tasks={openTasks}
          subjectMap={props.subjectMap}
          dueTodayCount={dueTodayTasks.length}
          overdueCount={overdueTasks.length}
          onOpen={() => props.onNavigate('Tasks')}
        />
        <FocusCard
          key={props.activeSession?.id ?? props.staleFocusSession?.id ?? 'idle'}
          focusMinutes={props.todayFocusMinutes}
          goalMinutes={props.dailyGoalMinutes}
          activeSession={props.activeSession}
          staleFocusSession={props.staleFocusSession}
          staleFocusSubjectName={props.staleFocusSubjectName}
          sessionLimitSeconds={props.sessionLimitSeconds}
          sessionNotice={props.sessionNotice}
          canStart={props.canStartFocus}
          transitionPending={props.focusTransitionPending}
          subjects={props.subjects}
          selectedSubjectId={props.focusSubjectId}
          durationMinutes={props.focusDurationMinutes}
          onSubjectChange={props.onFocusSubjectChange}
          onDurationChange={props.onFocusDurationChange}
          onStart={props.onStartSession}
          onPause={props.onPauseSession}
          onResume={props.onResumeSession}
          onStop={props.onStopSession}
          onAcceptStale={props.onAcceptStaleFocusSession}
          onDiscardStale={props.onDiscardStaleFocusSession}
        />
        <QuickNoteCard notes={props.quickNotes} onChange={props.onQuickNotesChange} onOpenNotes={() => props.onNavigate('Notes')} />
      </div>
      <SubjectsSection subjects={subjectStats} sessions={props.studySessions} onViewAll={() => props.onNavigate('Subjects')} />
      <div className="bottom-grid">
        <RecentNotes notes={recentNotes} subjectMap={props.subjectMap} onViewAll={() => props.onNavigate('Notes')} />
        <StudyTime days={props.weeklyStudyDays} />
      </div>
    </>
  )
}

function activateRecommendedNextAction(
  action: RecommendedNextAction,
  handlers: {
    onNavigate: (view: View) => void
    onCreateSubject: () => void
  },
) {
  switch (action.intent) {
    case 'navigate':
      if (action.view) handlers.onNavigate(action.view)
      return
    case 'create_subject':
      handlers.onCreateSubject()
      return
    case 'focus_card': {
      revealHomeFocusSession()
      return
    }
    default: {
      const _exhaustive: never = action.intent
      return _exhaustive
    }
  }
}

function recommendedActionCopy(action: RecommendedNextAction): { title: string; detail: string; buttonLabel: string } {
  switch (action.kind) {
    case 'overdue_task':
      return {
        title: 'Overdue task',
        detail: action.title ? `Catch up on "${action.title}".` : 'Open Tasks to clear overdue work.',
        buttonLabel: 'Open Tasks',
      }
    case 'due_today_task':
      return {
        title: 'Task due today',
        detail: action.title ? `Work on "${action.title}".` : 'Open Tasks to see what is due today.',
        buttonLabel: 'Open Tasks',
      }
    case 'due_flashcard':
      return {
        title: 'Flashcard due',
        detail: action.title ? `Review "${action.title}".` : 'Open Flashcards to start a review.',
        buttonLabel: 'Open Flashcards',
      }
    case 'today_event':
      return {
        title: 'Event today',
        detail: action.title ? `Prepare for "${action.title}".` : 'Open Calendar to see today\'s events.',
        buttonLabel: 'Open Calendar',
      }
    case 'continue_focus':
      return {
        title: 'Focus in progress',
        detail: 'Return to your active focus session.',
        buttonLabel: 'Go to focus',
      }
    case 'start_focus':
      return {
        title: 'Start focusing',
        detail: 'Begin a focus session toward today\'s study target.',
        buttonLabel: 'Go to focus',
      }
    case 'create_subject':
      return {
        title: 'Create a subject',
        detail: 'Add a subject so tasks, notes, and focus time stay organized.',
        buttonLabel: 'Create subject',
      }
    case 'neutral':
      return {
        title: 'Keep studying',
        detail: 'Today\'s target is met. Review Progress or start another focus session when you are ready.',
        buttonLabel: 'Open Progress',
      }
    default: {
      const _exhaustive: never = action.kind
      return _exhaustive
    }
  }
}

function HomeTodayDashboard(props: {
  dueTodayCount: number
  overdueCount: number
  dueFlashcardCount: number
  todayEventCount: number
  streakDays: number
  weekHours: number
  todayFocusMinutes: number
  dailyGoalMinutes: number
  overduePreview: StudyTask[]
  todayEventPreview: CalendarEvent[]
  recommended: RecommendedNextAction
  onActivateRecommended: () => void
  onOpenTasks: () => void
  onOpenFlashcards: () => void
  onOpenCalendar: () => void
}) {
  const copy = recommendedActionCopy(props.recommended)
  const targetPercent = Math.round(percent(props.todayFocusMinutes, props.dailyGoalMinutes))

  return (
    <section className="card home-today-card" aria-labelledby="home-today-title">
      <div className="card-heading">
        <div>
          <h2 id="home-today-title">Today</h2>
          <span>{targetPercent}% of today's focus target · {formatMinutes(props.todayFocusMinutes)} of {formatMinutes(props.dailyGoalMinutes)}</span>
        </div>
      </div>

      <ul className="home-today-metrics">
        <li className="home-today-metric" aria-label={`${props.dueTodayCount} tasks due today`}>
          <Target size={18} aria-hidden="true" />
          <div>
            <span className="home-today-metric-label">Due today</span>
            <strong>{props.dueTodayCount}</strong>
          </div>
          <button className="text-command home-today-metric-action" type="button" aria-label="View due-today items" onClick={props.onOpenTasks}>View</button>
        </li>
        <li className={`home-today-metric${props.overdueCount > 0 ? ' is-overdue' : ''}`} aria-label={`${props.overdueCount} overdue tasks`}>
          <Check size={18} aria-hidden="true" />
          <div>
            <span className="home-today-metric-label">Overdue</span>
            <strong>{props.overdueCount}</strong>
          </div>
          <button className="text-command home-today-metric-action" type="button" aria-label="View overdue items" onClick={props.onOpenTasks}>View</button>
        </li>
        <li className="home-today-metric" aria-label={`${props.dueFlashcardCount} flashcards due`}>
          <NotebookText size={18} aria-hidden="true" />
          <div>
            <span className="home-today-metric-label">Flashcards due</span>
            <strong>{props.dueFlashcardCount}</strong>
          </div>
          <button className="text-command home-today-metric-action" type="button" aria-label="View flashcard review" onClick={props.onOpenFlashcards}>View</button>
        </li>
        <li className="home-today-metric" aria-label={`${props.todayEventCount} events today`}>
          <CalendarDays size={18} aria-hidden="true" />
          <div>
            <span className="home-today-metric-label">Events today</span>
            <strong>{props.todayEventCount}</strong>
          </div>
          <button className="text-command home-today-metric-action" type="button" aria-label="View today's calendar" onClick={props.onOpenCalendar}>View</button>
        </li>
        <li className="home-today-metric" aria-label={`${props.streakDays} day study streak`}>
          <Flame size={18} aria-hidden="true" />
          <div>
            <span className="home-today-metric-label">Study streak</span>
            <strong>{props.streakDays}</strong>
          </div>
          <span className="home-today-metric-hint">days</span>
        </li>
        <li className="home-today-metric" aria-label={`${formatHours(props.weekHours)} focus in the last seven days`}>
          <Clock3 size={18} aria-hidden="true" />
          <div>
            <span className="home-today-metric-label">Last 7 days</span>
            <strong>{formatHours(props.weekHours)}</strong>
          </div>
          <span className="home-today-metric-hint">focus</span>
        </li>
      </ul>

      {(props.overduePreview.length > 0 || props.todayEventPreview.length > 0) ? (
        <div className="home-today-previews">
          {props.overduePreview.length > 0 ? (
            <div>
              <h3 className="home-today-preview-title">Overdue preview</h3>
              <ul className="home-today-preview-list">
                {props.overduePreview.map((task) => (
                  <li key={task.id}>{task.title}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {props.todayEventPreview.length > 0 ? (
            <div>
              <h3 className="home-today-preview-title">Today's events</h3>
              <ul className="home-today-preview-list">
                {props.todayEventPreview.map((event) => (
                  <li key={event.id}>{event.title}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="home-recommended">
        <div className="home-recommended-copy">
          <p className="home-recommended-eyebrow">Recommended next</p>
          <h3 className="home-recommended-title">{copy.title}</h3>
          <p className="home-recommended-detail">{copy.detail}</p>
        </div>
        <button
          className="primary-command home-recommended-action"
          type="button"
          onClick={props.onActivateRecommended}
        >
          {copy.buttonLabel}
        </button>
      </div>
    </section>
  )
}

function TaskCard({
  tasks,
  subjectMap,
  dueTodayCount,
  overdueCount,
  onOpen,
}: {
  tasks: StudyTask[]
  subjectMap: Map<string, StudySubject>
  dueTodayCount: number
  overdueCount: number
  onOpen: () => void
}) {
  return (
    <section className="card task-card" aria-labelledby="tasks-title">
      <div className="card-heading">
        <div>
          <h2 id="tasks-title">Study Tasks</h2>
          <span>{dueTodayCount} due today · {overdueCount} overdue · {tasks.length} open shown</span>
        </div>
        <button className="text-command" type="button" onClick={onOpen}>View</button>
      </div>
      {tasks.length > 0 ? (
        <ul className="task-list">
          {tasks.map((task) => (
            <li className="task" key={task.id}>
              <Square size={18} aria-hidden="true" />
              <span>{task.title}</span>
              <small>{subjectMap.get(task.subjectId)?.name ?? 'General'}</small>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Check} title="No tasks yet" body="Create your first task and it will stay here after refresh." actionLabel="New task" onAction={onOpen} />
      )}
    </section>
  )
}

function FocusCard(props: {
  focusMinutes: number
  goalMinutes: number
  activeSession: ActiveFocusSession | null
  staleFocusSession: ActiveFocusSession | null
  staleFocusSubjectName: string
  sessionLimitSeconds: number
  sessionNotice: string
  canStart: boolean
  transitionPending: boolean
  subjects: StudySubject[]
  selectedSubjectId: string
  durationMinutes: number
  onSubjectChange: (subjectId: string) => void
  onDurationChange: (minutes: number) => void
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => Promise<void>
  onAcceptStale: () => void
  onDiscardStale: () => void
}) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (!props.activeSession || props.activeSession.status === 'paused') return undefined
    // Sync on the next macrotask when entering `running` so resume does not paint against a stale clock.
    const syncTimer = window.setTimeout(() => setNowMs(Date.now()), 0)
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => {
      window.clearTimeout(syncTimer)
      window.clearInterval(timer)
    }
  }, [props.activeSession])

  const elapsedSeconds = props.activeSession
    ? Math.max(0, Math.floor(getActiveFocusElapsedMs(props.activeSession, nowMs) / 1000))
    : 0
  const focusPercent = percent(props.focusMinutes, props.goalMinutes)
  const timerPercent = props.sessionLimitSeconds > 0 ? percent(elapsedSeconds, props.sessionLimitSeconds) : focusPercent
  const remainingSeconds = props.sessionLimitSeconds > 0 ? Math.max(0, props.sessionLimitSeconds - elapsedSeconds) : 0
  const isPaused = props.activeSession?.status === 'paused'

  if (props.staleFocusSession && !props.activeSession) {
    const stale = props.staleFocusSession
    return (
      <section id={HOME_FOCUS_SESSION_ID} className="card focus-card" aria-labelledby="focus-stale-title" tabIndex={-1}>
        <h2 id="focus-stale-title">Unfinished focus session</h2>
        <p className="session-stale-copy">
          A focus session from {formatDateTime(stale.startedAt)} is still saved locally. It was{' '}
          {stale.status === 'paused' ? 'paused' : 'running'} for {props.staleFocusSubjectName}.
          Choose Resume to continue it, or Discard to remove it without logging study time.
        </p>
        {props.sessionNotice ? <p className="session-complete" role={sessionNoticeRole(props.sessionNotice)}>{props.sessionNotice}</p> : null}
        <div className="session-actions">
          <button className="primary-command session-button" type="button" onClick={props.onAcceptStale} disabled={props.transitionPending}>
            <Play size={18} aria-hidden="true" />
            Resume session
          </button>
          <button className="session-button" type="button" onClick={props.onDiscardStale} disabled={props.transitionPending}>
            Discard session
          </button>
        </div>
      </section>
    )
  }

  return (
    <section id={HOME_FOCUS_SESSION_ID} className="card focus-card" aria-labelledby="focus-title" tabIndex={-1}>
      <h2 id="focus-title">Focus session</h2>
      <div className="focus-ring" style={{ '--focus-percent': `${timerPercent}%` } as React.CSSProperties}>
        <div>
          <strong>{props.activeSession ? formatElapsed(props.sessionLimitSeconds > 0 ? remainingSeconds : elapsedSeconds) : formatMinutes(props.focusMinutes)}</strong>
          <span>
            {props.activeSession
              ? (isPaused ? 'paused' : props.sessionLimitSeconds > 0 ? 'remaining' : 'elapsed')
              : `of ${formatMinutes(props.goalMinutes)}`}
          </span>
        </div>
      </div>
      <div className="focus-stat-row" aria-label="Daily focus progress">
        <span>Daily target</span>
        <strong>{Math.round(focusPercent)}%</strong>
      </div>
      <label className="field focus-subject-field">
        <span>Session length</span>
        <select value={props.durationMinutes} onChange={(event) => props.onDurationChange(Number(event.target.value))} disabled={Boolean(props.activeSession)}>
          <option value={25}>25 min Pomodoro</option>
          <option value={50}>50 min deep work</option>
          <option value={0}>Open ended</option>
        </select>
      </label>
      <label className="field focus-subject-field">
        <span>Focus subject</span>
        <select value={props.selectedSubjectId} onChange={(event) => props.onSubjectChange(event.target.value)} disabled={props.transitionPending}>
          <option value="">General</option>
          {props.subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}
        </select>
      </label>
      {props.activeSession ? (
        <p className="session-elapsed">
          <span>Elapsed</span>
          <strong>{formatElapsed(elapsedSeconds)}</strong>
        </p>
      ) : null}
      {props.sessionNotice ? <p className="session-complete" role={sessionNoticeRole(props.sessionNotice)}>{props.sessionNotice}</p> : null}
      {props.activeSession ? (
        <div className="session-actions">
          {isPaused ? (
            <button className="primary-command session-button" type="button" onClick={props.onResume} disabled={props.transitionPending}>
              <Play size={18} aria-hidden="true" />
              Resume
            </button>
          ) : (
            <button className="primary-command session-button" type="button" onClick={props.onPause} disabled={props.transitionPending}>
              <Pause size={18} aria-hidden="true" />
              Pause
            </button>
          )}
          <button className="session-button" type="button" onClick={() => void props.onStop()} disabled={props.transitionPending}>
            <StopCircle size={18} aria-hidden="true" />
            Stop session
          </button>
        </div>
      ) : (
        <button className="primary-command session-button" type="button" onClick={props.onStart} disabled={!props.canStart || props.transitionPending}>
          <Play size={18} aria-hidden="true" />
          Start focus
        </button>
      )}
    </section>
  )
}

function sessionNoticeRole(message: string): 'alert' | 'status' {
  return /^could not\b/i.test(message) ? 'alert' : 'status'
}

function QuickNoteCard({ notes, onChange, onOpenNotes }: { notes: string[]; onChange: (value: string) => Promise<void>; onOpenNotes: () => void }) {
  const savedValue = notes.join('\n')
  const [draft, setDraft] = useState(savedValue)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [lastPersisted, setLastPersisted] = useState(savedValue)
  const [prevSavedValue, setPrevSavedValue] = useState(savedValue)
  const pendingRef = useRef<string | null>(null)
  const inFlightRef = useRef(false)
  const awaitingEchoRef = useRef(false)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Apply external live-query updates while rendering when this card has no local dirty work.
  // After a local save, ignore unchanged stale props until the live query echoes the write or delivers a newer value.
  if (savedValue !== prevSavedValue) {
    setPrevSavedValue(savedValue)
    const canApplyExternal = draft === lastPersisted
      && pendingRef.current === null
      && !inFlightRef.current
      && saveStatus === 'saved'

    if (awaitingEchoRef.current) {
      if (savedValue === lastPersisted) {
        awaitingEchoRef.current = false
      } else if (canApplyExternal) {
        awaitingEchoRef.current = false
        setDraft(savedValue)
        setLastPersisted(savedValue)
      }
    } else if (canApplyExternal && savedValue !== lastPersisted) {
      setDraft(savedValue)
      setLastPersisted(savedValue)
    }
  }

  const flushPending = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setSaveStatus('saving')
    let failed = false

    try {
      for (;;) {
        const next = pendingRef.current
        if (next === null) break
        pendingRef.current = null
        await onChangeRef.current(next)
        awaitingEchoRef.current = true
        setLastPersisted(next)
      }
      setSaveStatus('saved')
    } catch {
      failed = true
      awaitingEchoRef.current = false
      setSaveStatus('error')
    } finally {
      inFlightRef.current = false
    }

    if (!failed && pendingRef.current !== null) {
      window.setTimeout(() => {
        void flushPending()
      }, 0)
    }
  }, [])

  useEffect(() => {
    if (draft === lastPersisted && saveStatus !== 'error') return undefined
    const timer = window.setTimeout(() => {
      pendingRef.current = draft
      void flushPending()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [draft, flushPending, lastPersisted, saveStatus])

  const statusLabel = saveStatus === 'error'
    ? 'Quick notes could not be saved. Your text is still available.'
    : saveStatus === 'saving' || draft !== lastPersisted
      ? 'Saving...'
      : 'Saved locally'

  return (
    <section className="card quick-card" aria-labelledby="quick-notes-title">
      <div className="card-heading">
        <h2 id="quick-notes-title">Quick Notes</h2>
        <div className="quick-note-actions">
          <span
            className="save-status"
            role={saveStatus === 'error' ? 'alert' : undefined}
            aria-live={saveStatus === 'error' ? undefined : 'polite'}
          >
            {statusLabel}
          </span>
          {saveStatus === 'error' ? (
            <button
              className="text-command"
              type="button"
              onClick={() => {
                pendingRef.current = draft
                void flushPending()
              }}
            >
              Retry save
            </button>
          ) : null}
          <button className="text-command" type="button" onClick={onOpenNotes}>Open Notes</button>
        </div>
      </div>
      <label className="note-paper editable-paper">
        <span className="sr-only">Quick notes</span>
        <textarea
          value={draft}
          placeholder="Capture fast ideas, formulas, or reminders..."
          onChange={(event) => {
            setDraft(event.target.value)
            if (saveStatus === 'error') setSaveStatus('saving')
          }}
        />
      </label>
    </section>
  )
}

function SubjectsSection({ subjects, sessions, onViewAll }: { subjects: StudySubject[]; sessions: StudySession[]; onViewAll: () => void }) {
  return (
    <section className="subject-section" aria-labelledby="subjects-title">
      <div className="section-heading">
        <h2 id="subjects-title">Subjects</h2>
        <button type="button" onClick={onViewAll}>View all</button>
      </div>
      {subjects.length > 0 ? (
        <div className="subject-grid">
          {subjects.map((subject) => (
            <SubjectCard
              subject={subject}
              progressValue={calculateSubjectProgress(subject, sessions).percentage}
              key={subject.id}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={BookOpen} title="No subjects yet" body="Subjects organize tasks, notes, flashcards, and study time." actionLabel="Create subject" onAction={onViewAll} />
      )}
    </section>
  )
}

function RecentNotes({ notes, subjectMap, onViewAll }: { notes: StudyNote[]; subjectMap: Map<string, StudySubject>; onViewAll: () => void }) {
  return (
    <section className="card notes-card" aria-labelledby="notes-title">
      <div className="section-heading">
        <h2 id="notes-title">Recent Notes</h2>
        <button type="button" onClick={onViewAll}>View all</button>
      </div>
      {notes.length > 0 ? (
        <div className="note-list">
          {notes.map((note) => (
            <article className="note-row" key={note.id}>
              <FileText size={18} aria-hidden="true" />
              <h3>{note.title}</h3>
              <span className="pill">{subjectMap.get(note.subjectId)?.name ?? 'General'}</span>
              <time>{formatDate(note.updatedAt)}</time>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={FileText} title="No notes saved" body="Write a note from the Notes workspace and it will appear here." actionLabel="Go to notes workspace" onAction={onViewAll} />
      )}
    </section>
  )
}
