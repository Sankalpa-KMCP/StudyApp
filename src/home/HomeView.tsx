import { BookOpen, Check, FileText, Flame, NotebookText, Pause, Play, Square, StopCircle, Target, Search, type AppIcon } from '../components/icons'
import {
  formatDate,
  formatDateTime,
  formatElapsed,
  formatHours,
  formatMinutes,
  getSubjectProgress,
  isFlashcardDue,
  percent,
  type SearchResult,
  type WeeklyStudyDay,
} from '../appUtils'
import type { ActiveFocusSession, StudyData, StudyNote, StudySession, StudySubject, StudyTask } from '../db/types'
import { EmptyState, SubjectCard } from '../components/ui'
import { StudyTime } from '../components/RightColumn'
import type { View } from '../App'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FirstStudyChecklist } from './FirstStudyChecklist'
import { getActiveFocusElapsedMs } from '../db/activeFocusSession'

export function HomeView(props: {
  data: StudyData
  subjectMap: Map<string, StudySubject>
  weeklyStudyDays: WeeklyStudyDay[]
  quickNotes: string[]
  dailyGoalMinutes: number
  todayFocusMinutes: number
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
  search: string
  searchResults: SearchResult[]
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
  onClearSearch?: () => void
}) {
  const openTasks = props.data.tasks.filter((task) => task.status === 'open').slice(0, 5)
  const recentNotes = props.data.notes.slice(0, 3)
  const subjectStats = props.data.subjects.slice(0, 5)
  const dueCards = props.data.flashcards.filter((card) => isFlashcardDue(card)).length
  const weekHours = props.weeklyStudyDays.reduce((sum, day) => sum + day.hours, 0)

  return (
    <>
      {props.search.trim() ? (
        <HomeSearchResults query={props.search} results={props.searchResults} onNavigate={props.onNavigate} onClearSearch={props.onClearSearch || (() => {})} />
      ) : null}
      {!props.search.trim() ? (
        <FirstStudyChecklist
          hasSubject={props.data.subjects.length > 0}
          hasPlan={props.data.tasks.length > 0 || props.data.events.length > 0}
          hasSession={props.data.studySessions.length > 0}
          onCreateSubject={props.onCreateSubject}
          onCreatePlan={props.onCreatePlan}
          onLogSession={props.onLogSession}
        />
      ) : null}
      <div className="insight-grid" aria-label="Study pulse">
        <InsightTile icon={Target} label="Today target" value={`${Math.round(percent(props.todayFocusMinutes, props.dailyGoalMinutes))}%`} detail={`${formatMinutes(props.todayFocusMinutes)} of ${formatMinutes(props.dailyGoalMinutes)}`} />
        <InsightTile icon={Flame} label="Week momentum" value={formatHours(weekHours)} detail={`${props.weeklyStudyDays.filter((day) => day.hours > 0).length} active days`} />
        <InsightTile icon={NotebookText} label="Review queue" value={`${dueCards}`} detail={dueCards === 1 ? 'card due now' : 'cards due now'} />
      </div>
      <div className="summary-grid">
        <TaskCard tasks={openTasks} subjectMap={props.subjectMap} onOpen={() => props.onNavigate('Tasks')} />
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
      <SubjectsSection subjects={subjectStats} sessions={props.data.studySessions} onViewAll={() => props.onNavigate('Subjects')} />
      <div className="bottom-grid">
        <RecentNotes notes={recentNotes} subjectMap={props.subjectMap} onViewAll={() => props.onNavigate('Notes')} />
        <StudyTime days={props.weeklyStudyDays} />
      </div>
    </>
  )
}

function InsightTile({ icon: Icon, label, value, detail }: { icon: AppIcon; label: string; value: string; detail: string }) {
  return (
    <article className="insight-tile">
      <div className="insight-icon">
        <Icon size={20} aria-hidden="true" />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  )
}

function HomeSearchResults({ query, results, onNavigate, onClearSearch }: { query: string; results: SearchResult[]; onNavigate: (view: View) => void; onClearSearch: () => void }) {
  return (
    <section className="card search-results-card" aria-labelledby="home-search-title">
      <div className="card-heading">
        <div>
          <h2 id="home-search-title">Search Results</h2>
          <span>{results.length} matches for "{query.trim()}"</span>
        </div>
      </div>
      {results.length > 0 ? (
        <div className="search-result-list">
          {results.map((result) => (
            <button
              className="search-result-row"
              type="button"
              key={`${result.type}-${result.id}`}
              aria-label={`${result.type}: ${result.title}, ${result.meta}`}
              onClick={() => onNavigate(result.view)}
            >
              <span className="pill">{result.type}</span>
              <strong>{result.title}</strong>
              <small>{result.meta}</small>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="No matches found"
          body="No tasks, notes, subjects, events, or flashcards match that search."
          actionLabel="Clear search"
          onAction={onClearSearch}
        />
      )}
    </section>
  )
}

function TaskCard({ tasks, subjectMap, onOpen }: { tasks: StudyTask[]; subjectMap: Map<string, StudySubject>; onOpen: () => void }) {
  return (
    <section className="card task-card" aria-labelledby="tasks-title">
      <div className="card-heading">
        <div>
          <h2 id="tasks-title">Study Tasks</h2>
          <span>{tasks.length} open</span>
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
      <section className="card focus-card" aria-labelledby="focus-stale-title">
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
    <section className="card focus-card" aria-labelledby="focus-title">
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
  const pendingRef = useRef<string | null>(null)
  const inFlightRef = useRef(false)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

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
        setLastPersisted(next)
      }
      setSaveStatus('saved')
    } catch {
      failed = true
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
          {subjects.map((subject) => <SubjectCard subject={subject} progressValue={getSubjectProgress(subject, sessions)} key={subject.id} />)}
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
