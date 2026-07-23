import { useEffect, useRef, useState } from 'react'
import { Clock3, Save } from '../components/icons'
import type { StudyData, StudySession, StudySubject } from '../db/types'
import {
  formatHours,
  formatMinutes,
  formatShortTime,
  groupStudySessionsByLocalDate,
  parseLocalDateTime,
  percent,
  toInputDate,
  toInputTime,
  type WeeklyStudyDay,
} from '../appUtils'
import { createId, studyDb } from '../db/studyDb'
import { EmptyState, MetricCard, MutationNotice, PanelHeader, RowActionButtons } from '../components/ui'
import { StudyTime, SubjectDistribution } from '../components/RightColumn'
import { useMutationState, type MutationPhase } from '../hooks/useMutationState'

type SessionDraft = {
  subjectId: string
  date: string
  time: string
  duration: string
  note: string
}

export function ProgressView(props: {
  data: StudyData
  weeklyStudyDays: WeeklyStudyDay[]
  dailyGoalMinutes: number
  todayFocusMinutes: number
  subjectMap: Map<string, StudySubject>
  openEditorOnMount: boolean
}) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(() =>
    props.openEditorOnMount ? 'new' : null,
  )
  const [draft, setDraft] = useState<SessionDraft>(() => defaultSessionDraft())
  const [validationError, setValidationError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const editorTriggerRef = useRef<HTMLElement | null>(null)
  const logSessionButtonRef = useRef<HTMLButtonElement | null>(null)
  const restoreEditorFocusRef = useRef(false)
  const subjectFieldRef = useRef<HTMLSelectElement | null>(null)
  const dateFieldRef = useRef<HTMLInputElement | null>(null)
  const durationFieldRef = useRef<HTMLInputElement | null>(null)
  const saveMutation = useMutationState()
  const rowMutation = useMutationState()
  const { clearFeedback: clearSaveFeedback, isPending: isSaving, phase: savePhase, message: saveMessage, run: runSave } = saveMutation
  const { clearFeedback: clearRowFeedback, isPending: isRowPending, phase: rowPhase, message: rowMessage, run: runRow } = rowMutation

  const formErrorMessage = validationError
    ?? (savePhase === 'error' ? saveMessage : null)
  const formErrorId = formErrorMessage ? 'session-form-error' : undefined
  // Keep validation/save errors inline (aria-describedby); surface success and delete feedback via MutationNotice.
  const noticePhase: MutationPhase = savePhase === 'success'
    ? 'success'
    : rowPhase === 'success' || rowPhase === 'error'
      ? rowPhase
      : !editingSessionId && savePhase === 'error'
        ? 'error'
        : 'idle'
  const noticeMessage = savePhase === 'success'
    ? saveMessage
    : rowPhase === 'success' || rowPhase === 'error'
      ? rowMessage
      : !editingSessionId && savePhase === 'error'
        ? saveMessage
        : null

  const completed = props.data.tasks.filter((task) => task.status === 'done').length
  const weeklyHours = props.weeklyStudyDays.reduce((sum, day) => sum + day.hours, 0)
  const sessionGroups = groupStudySessionsByLocalDate(props.data.studySessions)
  const loadingLabel = editingSessionId && editingSessionId !== 'new' ? 'Saving session...' : 'Recording session...'
  const rowActionsLocked = isSaving || Boolean(pendingDeleteId)

  useEffect(() => {
    if (editingSessionId) {
      subjectFieldRef.current?.focus()
      return
    }
    if (restoreEditorFocusRef.current) {
      restoreEditorFocusRef.current = false
      const focusTarget = editorTriggerRef.current?.isConnected ? editorTriggerRef.current : logSessionButtonRef.current
      focusTarget?.focus()
    }
  }, [editingSessionId])

  const openEditor = (session?: StudySession) => {
    editorTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    restoreEditorFocusRef.current = false
    setValidationError(null)
    clearSaveFeedback()
    if (session) {
      const startedAt = new Date(session.startedAt)
      const fallbackDraft = defaultSessionDraft()
      const hasValidStart = !Number.isNaN(startedAt.getTime())
      setEditingSessionId(session.id)
      setDraft({
        subjectId: session.subjectId,
        date: hasValidStart ? toInputDate(startedAt) : fallbackDraft.date,
        time: hasValidStart ? toInputTime(startedAt) : fallbackDraft.time,
        duration: String(Math.max(1, session.minutes)),
        note: session.note ?? '',
      })
    } else {
      setEditingSessionId('new')
      setDraft(defaultSessionDraft())
    }
  }

  const closeEditor = () => {
    if (isSaving) return
    restoreEditorFocusRef.current = true
    setEditingSessionId(null)
    setDraft(defaultSessionDraft())
    setValidationError(null)
  }

  const dismissNotice = () => {
    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()
  }

  const saveSession = async () => {
    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()

    if (draft.subjectId && !props.subjectMap.has(draft.subjectId)) {
      setValidationError('Choose an available subject or General.')
      subjectFieldRef.current?.focus()
      return
    }

    const startedAt = parseLocalDateTime(draft.date, draft.time)
    if (!startedAt) {
      setValidationError('Enter a valid date and start time.')
      dateFieldRef.current?.focus()
      return
    }

    const minutes = Number(draft.duration)
    if (!Number.isInteger(minutes) || minutes < 1) {
      setValidationError('Duration must be at least 1 minute.')
      durationFieldRef.current?.focus()
      return
    }

    const endedAt = new Date(startedAt.getTime() + minutes * 60_000)
    if (endedAt.getTime() > Date.now()) {
      setValidationError('Session end time cannot be in the future.')
      durationFieldRef.current?.focus()
      return
    }

    const isEdit = Boolean(editingSessionId && editingSessionId !== 'new')
    const payload = {
      subjectId: draft.subjectId,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      minutes,
      note: draft.note.trim(),
    }

    await runSave(async () => {
      if (isEdit && editingSessionId) {
        const updated = await studyDb.studySessions.update(editingSessionId, payload)
        if (updated === 0) throw new Error('Session no longer exists.')
        return
      }

      await studyDb.studySessions.add({ id: createId('session'), ...payload })
    }, {
      successMessage: isEdit ? 'Study session updated.' : 'Study session recorded.',
      errorMessage: 'Study session could not be saved. Your details are still in the form.',
      onSuccess: () => {
        restoreEditorFocusRef.current = true
        setEditingSessionId(null)
        setDraft(defaultSessionDraft())
        setValidationError(null)
      },
    })
  }

  const deleteSession = async (session: StudySession) => {
    if (pendingDeleteId || isSaving || isRowPending) return

    const startTime = sessionStartLabel(session)
    if (!window.confirm(`Delete session from ${startTime}? This cannot be undone.`)) return

    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()
    setPendingDeleteId(session.id)

    try {
      await runRow(async () => {
        await studyDb.studySessions.delete(session.id)
      }, {
        successMessage: 'Study session deleted.',
        errorMessage: 'Study session could not be deleted. Please try again.',
        onSuccess: () => {
          if (editingSessionId === session.id) {
            restoreEditorFocusRef.current = true
            setEditingSessionId(null)
            setDraft(defaultSessionDraft())
            setValidationError(null)
          }
        },
      })
    } finally {
      setPendingDeleteId(null)
    }
  }

  return (
    <section className="workspace-panel" aria-labelledby="progress-workspace-title">
      <PanelHeader title="Progress" description="Review the work you logged and where your study time went." actionLabel="Log session" actionRef={logSessionButtonRef} onAction={() => openEditor()} />
      <MutationNotice phase={noticePhase} message={noticeMessage} onDismiss={dismissNotice} />
      {editingSessionId ? (
        <form
          className="editor-card session-editor"
          aria-labelledby="session-editor-title"
          aria-busy={isSaving || undefined}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void saveSession()
          }}
        >
          <div className="session-editor-heading">
            <h2 id="session-editor-title">{editingSessionId === 'new' ? 'Log study session' : 'Edit study session'}</h2>
            <p>Record completed study time. Starting a focus timer remains a separate Home action.</p>
          </div>
          <label className="field">
            <span>Subject</span>
            <select
              ref={subjectFieldRef}
              value={draft.subjectId}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, subjectId: event.target.value })}
              aria-describedby={formErrorId}
            >
              <option value="">General</option>
              {draft.subjectId && !props.subjectMap.has(draft.subjectId) ? <option value={draft.subjectId} disabled>Missing subject — choose another</option> : null}
              {props.data.subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Date</span>
            <input
              ref={dateFieldRef}
              type="date"
              required
              disabled={isSaving}
              value={draft.date}
              onChange={(event) => setDraft({ ...draft, date: event.target.value })}
              aria-describedby={formErrorId}
            />
          </label>
          <label className="field">
            <span>Start time</span>
            <input
              type="time"
              required
              disabled={isSaving}
              value={draft.time}
              onChange={(event) => setDraft({ ...draft, time: event.target.value })}
              aria-describedby={formErrorId}
            />
          </label>
          <label className="field">
            <span>Duration (minutes)</span>
            <input
              ref={durationFieldRef}
              type="number"
              min="1"
              step="1"
              required
              disabled={isSaving}
              value={draft.duration}
              onChange={(event) => setDraft({ ...draft, duration: event.target.value })}
              aria-describedby={formErrorId}
            />
          </label>
          <label className="field session-note-field">
            <span>Note <small>Optional</small></span>
            <textarea
              rows={3}
              disabled={isSaving}
              value={draft.note}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
              placeholder="What did you work on?"
            />
          </label>
          {formErrorMessage ? (
            <p className="settings-feedback error session-form-error" id="session-form-error" role="alert">
              {formErrorMessage}
            </p>
          ) : null}
          <div className="editor-actions session-editor-actions">
            <button className="primary-command" type="submit" disabled={isSaving} aria-busy={isSaving || undefined}>
              <Save size={16} aria-hidden="true" />
              {isSaving ? loadingLabel : editingSessionId === 'new' ? 'Save session' : 'Update session'}
            </button>
            <button className="secondary-command" type="button" onClick={closeEditor} disabled={isSaving}>Cancel</button>
          </div>
        </form>
      ) : null}
      <div className="metric-grid">
        <MetricCard label="Weekly study" value={formatHours(weeklyHours)} />
        <MetricCard label="Tasks complete" value={`${completed}/${props.data.tasks.length}`} />
        <MetricCard label="Focus target" value={`${Math.round(percent(props.todayFocusMinutes, props.dailyGoalMinutes))}%`} />
        <MetricCard label="Cards remembered" value={`${props.data.flashcards.filter((card) => card.status === 'remembered').length}`} />
      </div>
      <section className="session-journal" aria-labelledby="study-journal-title">
        <div className="section-heading session-journal-heading">
          <div>
            <h2 id="study-journal-title">Study journal</h2>
            <p>{props.data.studySessions.length} {props.data.studySessions.length === 1 ? 'session' : 'sessions'} logged</p>
          </div>
        </div>
        {sessionGroups.length > 0 ? (
          <div className="session-ledger">
            {sessionGroups.map((group) => (
              <section className="session-day" aria-labelledby={`session-day-${group.key}`} key={group.key}>
                <div className="session-day-heading">
                  <h3 id={`session-day-${group.key}`}>{group.label}</h3>
                  <span>{formatMinutes(group.sessions.reduce((sum, session) => sum + session.minutes, 0))}</span>
                </div>
                {group.sessions.map((session) => {
                  const subject = session.subjectId ? props.subjectMap.get(session.subjectId) : undefined
                  const subjectName = session.subjectId ? subject?.name ?? 'Missing subject' : 'General'
                  const startTime = sessionStartLabel(session)
                  return (
                    <article className="session-row" aria-label={`${subjectName}, ${startTime}, ${formatMinutes(session.minutes)}`} key={session.id}>
                      <time className="session-time" dateTime={session.startedAt}>{startTime}</time>
                      <div className="session-copy">
                        <h4 className={session.subjectId && !subject ? 'is-missing' : undefined}>{subjectName}</h4>
                        {session.note ? <p>{session.note}</p> : null}
                      </div>
                      <strong className="session-duration">{formatMinutes(session.minutes)}</strong>
                      <RowActionButtons
                        label={`${subjectName} session at ${startTime}`}
                        onEdit={() => openEditor(session)}
                        onDelete={() => void deleteSession(session)}
                        confirmDelete={false}
                        isDisabled={rowActionsLocked}
                        isDeleting={pendingDeleteId === session.id}
                      />
                    </article>
                  )
                })}
              </section>
            ))}
          </div>
        ) : (
          <EmptyState icon={Clock3} title="No sessions logged" body="Log completed study time here or finish a focus session from Home." actionLabel="Log first session" onAction={() => openEditor()} />
        )}
      </section>
      <StudyTime days={props.weeklyStudyDays} />
      <SubjectDistribution subjects={props.data.subjects} sessions={props.data.studySessions} subjectMap={props.subjectMap} />
    </section>
  )
}

function defaultSessionDraft(): SessionDraft {
  const end = new Date()
  end.setSeconds(0, 0)
  const start = new Date(end.getTime() - 30 * 60_000)
  return {
    subjectId: '',
    date: toInputDate(start),
    time: toInputTime(start),
    duration: '30',
    note: '',
  }
}

function sessionStartLabel(session: StudySession) {
  return Number.isNaN(new Date(session.startedAt).getTime()) ? 'Unknown time' : formatShortTime(session.startedAt)
}
