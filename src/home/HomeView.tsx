import { BookOpen, CalendarDays, Check, FileText, Pause, Play, Square, StopCircle, Target } from '../components/icons'
import {
  calculateSubjectProgress,
  formatDate,
  formatDateTime,
  formatElapsed,
  formatMinutes,
  getCreditedSubjectStudyMinutesMap,
  percent,
  type WeeklyStudyDay,
} from '../appUtils'
import type { ActiveFocusSession, CalendarEvent, StudyNote, StudySession, StudySubject, StudyTask } from '../db/types'
import type { DensityMode } from '../hooks/useDensityPreference'
import { EmptyState, MutationNotice, SubjectCard } from '../components/ui'
import type { View } from '../navigation/viewRoutes'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FirstStudyChecklist } from './FirstStudyChecklist'
import { getActiveFocusElapsedMs } from '../db/activeFocusSession'
import { useMutationState } from '../hooks/useMutationState'
import {
  getOpenOverdueTasks,
  getOpenTasksDueToday,
  getTodaysEvents,
} from './dashboardDateHelpers'
import {
  getRecommendedNextAction,
  type RecommendedNextAction,
} from './recommendedNextAction'
import { hasStartedFocusSession } from './firstStudyChecklistData'
import { HOME_FOCUS_SESSION_ID, revealHomeFocusSession } from './revealHomeFocusSession'

export { HOME_FOCUS_SESSION_ID } from './revealHomeFocusSession'

import type { DatabaseMutationContext } from '../db/databaseMutationGuard'

export function HomeView(props: {
  notes: StudyNote[]
  events: CalendarEvent[]
  tasks: StudyTask[]
  studySessions: StudySession[]
  subjectMap: Map<string, StudySubject>
  weeklyStudyDays: WeeklyStudyDay[]
  quickNotes: string[]
  dailyGoalMinutes: number
  databaseGeneration?: number
  onboardingChecklistDismissed: boolean
  todayFocusMinutes: number
  currentDate: Date
  activeSession: ActiveFocusSession | null
  staleFocusSession: ActiveFocusSession | null
  staleFocusSubjectName: string
  sessionLimitSeconds: number
  elapsedSeconds?: number
  remainingSeconds?: number
  sessionNotice: string
  canStartFocus: boolean
  focusTransitionPending: boolean
  subjects: StudySubject[]
  focusSubjectId: string
  focusDurationMinutes: number
  focusAttentionRequest?: number
  density?: DensityMode
  onFocusSubjectChange: (subjectId: string) => void
  onFocusDurationChange: (minutes: number) => void
  onQuickNotesChange: (value: string, context: DatabaseMutationContext) => Promise<void>
  onStartSession: () => void
  onPauseSession: () => void
  onResumeSession: () => void
  onStopSession: () => Promise<void>
  onAcceptStaleFocusSession: () => void
  onDiscardStaleFocusSession: () => void
  onNavigate: (view: View) => void
  onCreateSubject: () => void
  onCreateTask: () => void
  onRevealFocusSession: () => void
  onDismissOnboardingChecklist: () => Promise<void>
}) {
  const focusAttentionRequest = props.focusAttentionRequest ?? 0
  const handledFocusAttention = useRef(0)
  const homeTodayTitleRef = useRef<HTMLHeadingElement | null>(null)
  const restoreFocusAfterChecklistDismiss = useRef(false)
  const dismissChecklistMutation = useMutationState()

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
  const recommended = getRecommendedNextAction({
    tasks: props.tasks,
    events: props.events,
    subjects: props.subjects,
    activeSession: props.activeSession,
    todayFocusMinutes: props.todayFocusMinutes,
    dailyGoalMinutes: props.dailyGoalMinutes,
    now,
  })

  const density = props.density ?? 'comfortable'
  const isCompact = density === 'compact'
  const openTasks = props.tasks.filter((task) => task.status === 'open').slice(0, isCompact ? 3 : 5)
  const recentNotes = props.notes.slice(0, 3)
  const subjectStats = props.subjects.slice(0, isCompact ? 3 : 5)
  const hasSubject = props.subjects.length > 0
  const hasTask = props.tasks.length > 0
  const hasStartedFocus = hasStartedFocusSession(
    props.activeSession,
    props.staleFocusSession,
    props.studySessions,
  )
  const showChecklist = !props.onboardingChecklistDismissed && !(hasSubject && hasTask && hasStartedFocus)

  useEffect(() => {
    if (showChecklist || !restoreFocusAfterChecklistDismiss.current) return
    homeTodayTitleRef.current?.focus()
    restoreFocusAfterChecklistDismiss.current = false
  }, [showChecklist])

  const activateRecommended = () => {
    activateRecommendedNextAction(recommended, {
      onNavigate: props.onNavigate,
      onCreateSubject: props.onCreateSubject,
    })
  }

  const dismissChecklist = () => {
    dismissChecklistMutation.clearFeedback()
    void dismissChecklistMutation.run(async () => {
      await props.onDismissOnboardingChecklist()
    }, {
      errorMessage: 'Onboarding checklist could not be dismissed. Please try again.',
      onSuccess: () => {
        restoreFocusAfterChecklistDismiss.current = true
      },
    })
  }

  return (
    <>
      {showChecklist ? (
        <>
          <FirstStudyChecklist
            hasSubject={hasSubject}
            hasTask={hasTask}
            hasStartedFocus={hasStartedFocus}
            onCreateSubject={props.onCreateSubject}
            onCreateTask={props.onCreateTask}
            onRevealFocus={props.onRevealFocusSession}
            onDismiss={dismissChecklist}
            dismissPending={dismissChecklistMutation.isPending}
          />
          <MutationNotice
            phase={dismissChecklistMutation.phase}
            message={dismissChecklistMutation.message}
            onDismiss={dismissChecklistMutation.clearFeedback}
          />
        </>
      ) : null}
      <HomeTodayDashboard
        headingRef={homeTodayTitleRef}
        dueTodayCount={dueTodayTasks.length}
        overdueCount={overdueTasks.length}
        todayEventCount={todaysEvents.length}
        overduePreview={isCompact ? [] : overdueTasks.slice(0, 2)}
        todayEventPreview={isCompact ? [] : todaysEvents.slice(0, 2)}
        recommended={recommended}
        onActivateRecommended={activateRecommended}
        onOpenTasks={() => props.onNavigate('Tasks')}
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
          elapsedSeconds={props.elapsedSeconds}
          remainingSeconds={props.remainingSeconds}
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
        <QuickNoteCard
          notes={props.quickNotes}
          databaseGeneration={props.databaseGeneration ?? 1}
          onChange={props.onQuickNotesChange}
          onOpenNotes={() => props.onNavigate('Notes')}
          density={density}
        />
      </div>
      <SubjectsSection subjects={subjectStats} sessions={props.studySessions} now={now} onViewAll={() => props.onNavigate('Subjects')} />
      {density === 'comfortable' ? (
        <RecentNotes notes={recentNotes} subjectMap={props.subjectMap} onViewAll={() => props.onNavigate('Notes')} />
      ) : null}
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

function HomeTodayDashboard({
  headingRef,
  dueTodayCount,
  overdueCount,
  todayEventCount,
  overduePreview,
  todayEventPreview,
  recommended,
  onActivateRecommended,
  onOpenTasks,
  onOpenCalendar,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>
  dueTodayCount: number
  overdueCount: number
  todayEventCount: number
  overduePreview: StudyTask[]
  todayEventPreview: CalendarEvent[]
  recommended: RecommendedNextAction
  onActivateRecommended: () => void
  onOpenTasks: () => void
  onOpenCalendar: () => void
}) {
  const copy = recommendedActionCopy(recommended)

  return (
    <section className="card home-today-card" aria-labelledby="home-today-title">
      <div className="card-heading">
        <h2 id="home-today-title" ref={headingRef} tabIndex={-1}>Today</h2>
      </div>

      <ul className="home-today-metrics">
        <li className="home-today-metric" aria-label={`${dueTodayCount} tasks due today`}>
          <Target size={18} aria-hidden="true" />
          <div>
            <span className="home-today-metric-label">Due today</span>
            <strong>{dueTodayCount}</strong>
          </div>
          <button className="text-command home-today-metric-action" type="button" aria-label="View due-today items" onClick={onOpenTasks}>View</button>
        </li>
        <li className={`home-today-metric${overdueCount > 0 ? ' is-overdue' : ''}`} aria-label={`${overdueCount} overdue tasks`}>
          <Check size={18} aria-hidden="true" />
          <div>
            <span className="home-today-metric-label">Overdue</span>
            <strong>{overdueCount}</strong>
          </div>
          <button className="text-command home-today-metric-action" type="button" aria-label="View overdue items" onClick={onOpenTasks}>View</button>
        </li>
        <li className="home-today-metric" aria-label={`${todayEventCount} events today`}>
          <CalendarDays size={18} aria-hidden="true" />
          <div>
            <span className="home-today-metric-label">Events today</span>
            <strong>{todayEventCount}</strong>
          </div>
          <button className="text-command home-today-metric-action" type="button" aria-label="View today's calendar" onClick={onOpenCalendar}>View</button>
        </li>
      </ul>

      {(overduePreview.length > 0 || todayEventPreview.length > 0) ? (
        <div className="home-today-previews">
          {overduePreview.length > 0 ? (
            <div>
              <h3 className="home-today-preview-title">Overdue preview</h3>
              <ul className="home-today-preview-list">
                {overduePreview.map((task) => (
                  <li key={task.id}>{task.title}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {todayEventPreview.length > 0 ? (
            <div>
              <h3 className="home-today-preview-title">Today's events</h3>
              <ul className="home-today-preview-list">
                {todayEventPreview.map((event) => (
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
          onClick={onActivateRecommended}
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
  elapsedSeconds?: number
  remainingSeconds?: number
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
  const elapsedSeconds = props.elapsedSeconds !== undefined
    ? props.elapsedSeconds
    : (props.activeSession ? Math.max(0, Math.floor(getActiveFocusElapsedMs(props.activeSession) / 1000)) : 0)
  const remainingSeconds = props.remainingSeconds !== undefined
    ? props.remainingSeconds
    : (props.sessionLimitSeconds > 0 ? Math.max(0, props.sessionLimitSeconds - elapsedSeconds) : 0)
  const focusPercent = percent(props.focusMinutes, props.goalMinutes)
  const timerPercent = props.sessionLimitSeconds > 0 ? percent(elapsedSeconds, props.sessionLimitSeconds) : focusPercent
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

function QuickNoteCard({
  notes,
  databaseGeneration = 1,
  onChange,
  onOpenNotes,
  density = 'comfortable',
}: {
  notes: string[]
  databaseGeneration?: number
  onChange: (value: string, context: DatabaseMutationContext) => Promise<void>
  onOpenNotes: () => void
  density?: DensityMode
}) {
  const savedValue = notes.join('\n')
  const [draft, setDraft] = useState(savedValue)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [lastPersisted, setLastPersisted] = useState(savedValue)
  const [prevSavedValue, setPrevSavedValue] = useState(savedValue)
  const draftRef = useRef(draft)
  const lastPersistedRef = useRef(lastPersisted)
  const epochGenerationRef = useRef(databaseGeneration)
  const isMountedRef = useRef(true)
  const pendingRef = useRef<string | null>(null)
  const inFlightRef = useRef(false)
  const awaitingEchoRef = useRef(false)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    lastPersistedRef.current = lastPersisted
  }, [lastPersisted])

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
        draftRef.current = savedValue
        lastPersistedRef.current = savedValue
      }
    } else if (canApplyExternal && savedValue !== lastPersisted) {
      setDraft(savedValue)
      setLastPersisted(savedValue)
      draftRef.current = savedValue
      lastPersistedRef.current = savedValue
    }
  }

  const flushPending = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    if (isMountedRef.current) setSaveStatus('saving')
    let failed = false

    try {
      for (;;) {
        const next = pendingRef.current
        if (next === null) break
        pendingRef.current = null
        await onChangeRef.current(next, { expectedGeneration: epochGenerationRef.current })
        awaitingEchoRef.current = true
        lastPersistedRef.current = next
        if (isMountedRef.current) setLastPersisted(next)
      }
      if (isMountedRef.current) setSaveStatus('saved')
    } catch {
      failed = true
      awaitingEchoRef.current = false
      if (isMountedRef.current) setSaveStatus('error')
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

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      const latestDraft = draftRef.current
      if (latestDraft !== lastPersistedRef.current) {
        pendingRef.current = latestDraft
        void flushPending()
      }
    }
  }, [flushPending])

  const handleBlur = useCallback(() => {
    const latestDraft = draftRef.current
    if (latestDraft !== lastPersistedRef.current) {
      pendingRef.current = latestDraft
      void flushPending()
    }
  }, [flushPending])

  const statusLabel = saveStatus === 'error'
    ? 'Quick notes could not be saved. Your text is still available.'
    : saveStatus === 'saving' || draft !== lastPersisted
      ? 'Saving...'
      : 'Saved locally'

  if (density === 'compact') {
    return (
      <details className="card quick-card quick-card-disclosure" aria-label="Quick notes">
        <summary className="quick-disclosure-summary">
          <span className="quick-disclosure-title">Quick Notes</span>
          <span className="quick-disclosure-meta">
            <span
              className="save-status"
              role={saveStatus === 'error' ? 'alert' : undefined}
              aria-live={saveStatus === 'error' ? undefined : 'polite'}
            >
              {statusLabel}
            </span>
          </span>
        </summary>
        <div className="quick-disclosure-content">
          <label className="note-paper editable-paper">
            <span className="sr-only">Quick notes</span>
            <textarea
              value={draft}
              placeholder="Capture fast ideas, formulas, or reminders..."
              onChange={(event) => {
                if (draft === lastPersisted || saveStatus === 'error') {
                  epochGenerationRef.current = databaseGeneration
                }
                setDraft(event.target.value)
                if (saveStatus === 'error') setSaveStatus('saving')
              }}
              onBlur={handleBlur}
            />
          </label>
          <div className="quick-disclosure-actions">
            {saveStatus === 'error' ? (
              <button
                className="text-command"
                type="button"
                onClick={() => {
                  epochGenerationRef.current = databaseGeneration
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
      </details>
    )
  }

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
                epochGenerationRef.current = databaseGeneration
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
            if (draft === lastPersisted || saveStatus === 'error') {
              epochGenerationRef.current = databaseGeneration
            }
            setDraft(event.target.value)
            if (saveStatus === 'error') setSaveStatus('saving')
          }}
          onBlur={handleBlur}
        />
      </label>
    </section>
  )
}

function SubjectsSection({ subjects, sessions, now, onViewAll }: { subjects: StudySubject[]; sessions: StudySession[]; now?: Date; onViewAll: () => void }) {
  const sessionMinutesMap = useMemo(() => getCreditedSubjectStudyMinutesMap(sessions, now), [now, sessions])

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
              progressValue={calculateSubjectProgress(subject, sessionMinutesMap, now).percentage}
              key={subject.id}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={BookOpen} title="No subjects yet" body="Subjects organize tasks, notes, and study time." actionLabel="Create subject" onAction={onViewAll} />
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
