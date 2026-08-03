import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays } from '../components/icons'
import {
  PanelHeader,
  TextInput,
  NumberInput,
  SubjectSelect,
  EditorActions,
  RowActionButtons,
  EmptyState,
  MutationNotice,
} from '../components/ui'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from '../db/calendarEventService'
import type { CalendarEvent, StudySubject } from '../db/types'
import { formatDateTime, todayInputValue, toInputDate, toInputTime } from '../appUtils'
import { CalendarStrip } from '../components/CalendarStrip'
import { useMutationState, type MutationPhase } from '../hooks/useMutationState'
import { validateCalendarEventEditorDraft } from '../validation/editorDraftValidation'

type CalendarValidationField = 'title' | 'start' | 'duration'

const EVENT_TITLE_ERROR_ID = 'event-title-error'
const EVENT_START_ERROR_ID = 'event-start-error'
const EVENT_DURATION_ERROR_ID = 'event-duration-error'

import {
  CALENDAR_EDITOR_DURATION_MAX,
  CALENDAR_EDITOR_DURATION_MIN,
} from '../validation/editorLimits'

type EventDraft = {
  title: string
  subjectId: string
  date: string
  time: string
  duration: number
  location: string
}

const emptyDraft = (subjectId = ''): EventDraft => ({
  title: '',
  subjectId,
  date: todayInputValue(),
  time: '09:00',
  duration: 60,
  location: '',
})

export function CalendarView({
  events,
  subjects,
  subjectMap,
  openEditorRequest = 0,
  search = '',
  onClearSearch = () => {},
}: {
  events: CalendarEvent[]
  subjects: StudySubject[]
  subjectMap: Map<string, StudySubject>
  openEditorRequest?: number
  search?: string
  onClearSearch?: () => void
}) {
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EventDraft>(() => emptyDraft())
  const [validationError, setValidationError] = useState<string | null>(null)
  const [validationField, setValidationField] = useState<CalendarValidationField | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const titleFieldRef = useRef<HTMLInputElement | null>(null)
  const dateFieldRef = useRef<HTMLInputElement | null>(null)
  const durationFieldRef = useRef<HTMLInputElement | null>(null)
  const handledEditorRequest = useRef(0)
  const saveMutation = useMutationState()
  const rowMutation = useMutationState()
  const { clearFeedback: clearSaveFeedback, isPending: isSaving, phase: savePhase, message: saveMessage, run: runSave } = saveMutation
  const { clearFeedback: clearRowFeedback, isPending: isRowPending, phase: rowPhase, message: rowMessage, run: runRow } = rowMutation

  const noticePhase: MutationPhase = savePhase === 'success' || savePhase === 'error'
    ? savePhase
    : rowPhase === 'success' || rowPhase === 'error'
      ? rowPhase
      : 'idle'
  const noticeMessage = (savePhase === 'success' || savePhase === 'error' ? saveMessage : null)
    ?? (rowPhase === 'success' || rowPhase === 'error' ? rowMessage : null)

  const clearValidation = useCallback(() => {
    setValidationError(null)
    setValidationField(null)
  }, [])

  const openEditor = useCallback((event?: CalendarEvent) => {
    clearValidation()
    clearSaveFeedback()
    if (event) {
      const start = new Date(event.startAt)
      const end = new Date(event.endAt)
      const hasValidStart = !Number.isNaN(start.getTime())
      const hasValidEnd = !Number.isNaN(end.getTime())
      setEditingEventId(event.id)
      setDraft({
        title: event.title,
        subjectId: event.subjectId,
        date: hasValidStart ? toInputDate(start) : todayInputValue(),
        time: hasValidStart ? toInputTime(start) : '09:00',
        duration: hasValidStart && hasValidEnd
          ? Math.max(CALENDAR_EDITOR_DURATION_MIN, Math.round((end.getTime() - start.getTime()) / 60_000))
          : 60,
        location: event.location ?? '',
      })
      return
    }

    setEditingEventId('new')
    setDraft(emptyDraft(subjects[0]?.id ?? ''))
  }, [clearSaveFeedback, clearValidation, subjects])

  useEffect(() => {
    if (openEditorRequest > handledEditorRequest.current) {
      handledEditorRequest.current = openEditorRequest
      openEditor()
    }
  }, [openEditor, openEditorRequest])

  const closeEditor = useCallback(() => {
    if (isSaving) return
    setEditingEventId(null)
    setDraft(emptyDraft(subjects[0]?.id ?? ''))
    clearValidation()
  }, [clearValidation, isSaving, subjects])

  const dismissNotice = () => {
    clearValidation()
    clearSaveFeedback()
    clearRowFeedback()
  }

  const saveEvent = async () => {
    clearValidation()
    clearSaveFeedback()
    clearRowFeedback()

    const validated = validateCalendarEventEditorDraft(draft)
    if (!validated.ok) {
      if (validated.reason === 'empty_title') {
        setValidationField('title')
        setValidationError('Enter an event title.')
        titleFieldRef.current?.focus()
        return
      }
      if (validated.reason === 'invalid_start') {
        setValidationField('start')
        setValidationError('Enter a valid date and start time.')
        dateFieldRef.current?.focus()
        return
      }
      setValidationField('duration')
      setValidationError('Duration must be at least 15 minutes.')
      durationFieldRef.current?.focus()
      return
    }

    const isEdit = Boolean(editingEventId && editingEventId !== 'new')
    const fields = validated.fields

    await runSave(async () => {
      if (isEdit && editingEventId) {
        await updateCalendarEvent(editingEventId, fields)
        return
      }

      await createCalendarEvent(fields)
    }, {
      successMessage: isEdit ? 'Event updated.' : 'Event created.',
      errorMessage: 'Event could not be saved. Check the details and try again.',
      onSuccess: () => {
        setEditingEventId(null)
        setDraft(emptyDraft(subjects[0]?.id ?? ''))
        clearValidation()
      },
    })
  }

  const deleteEvent = async (event: CalendarEvent) => {
    if (pendingDeleteId || isSaving || isRowPending) return

    clearValidation()
    clearSaveFeedback()
    clearRowFeedback()
    setPendingDeleteId(event.id)

    try {
      await runRow(async () => {
        await deleteCalendarEvent(event.id)
      }, {
        successMessage: 'Event deleted.',
        errorMessage: 'Event could not be deleted. Please try again.',
        onSuccess: () => {
          if (editingEventId === event.id) {
            setEditingEventId(null)
            setDraft(emptyDraft(subjects[0]?.id ?? ''))
            clearValidation()
          }
        },
      })
    } finally {
      setPendingDeleteId(null)
    }
  }

  const loadingLabel = editingEventId && editingEventId !== 'new' ? 'Saving event...' : 'Creating event...'
  const rowActionsLocked = isSaving || Boolean(pendingDeleteId)
  const titleInvalid = validationField === 'title'
  const startInvalid = validationField === 'start'
  const durationInvalid = validationField === 'duration'

  return (
    <section className="workspace-panel" aria-labelledby="calendar-workspace-title">
      <PanelHeader title="Calendar" description="Schedule classes, study blocks, and deadlines." actionLabel="New event" onAction={() => openEditor()} />
      <MutationNotice phase={noticePhase} message={noticeMessage} onDismiss={dismissNotice} />
      <CalendarStrip events={events} />
      {editingEventId ? (
        <div className="editor-card" aria-busy={isSaving || undefined}>
          <TextInput
            id="event-title"
            label="Event title"
            value={draft.title}
            inputRef={titleFieldRef}
            invalid={titleInvalid}
            describedBy={titleInvalid ? EVENT_TITLE_ERROR_ID : undefined}
            onChange={(title) => setDraft({ ...draft, title })}
          />
          {titleInvalid ? (
            <p id={EVENT_TITLE_ERROR_ID} className="settings-feedback error" role="alert">
              {validationError}
            </p>
          ) : null}
          <SubjectSelect subjects={subjects} value={draft.subjectId} onChange={(subjectId) => setDraft({ ...draft, subjectId })} />
          <TextInput
            id="event-date"
            label="Date"
            type="date"
            value={draft.date}
            inputRef={dateFieldRef}
            invalid={startInvalid}
            describedBy={startInvalid ? EVENT_START_ERROR_ID : undefined}
            onChange={(date) => setDraft({ ...draft, date })}
          />
          <TextInput
            label="Time"
            type="time"
            value={draft.time}
            invalid={startInvalid}
            describedBy={startInvalid ? EVENT_START_ERROR_ID : undefined}
            onChange={(time) => setDraft({ ...draft, time })}
          />
          {startInvalid ? (
            <p id={EVENT_START_ERROR_ID} className="settings-feedback error" role="alert">
              {validationError}
            </p>
          ) : null}
          <NumberInput
            id="event-duration"
            label="Duration"
            value={draft.duration}
            inputRef={durationFieldRef}
            invalid={durationInvalid}
            describedBy={durationInvalid ? EVENT_DURATION_ERROR_ID : undefined}
            min={CALENDAR_EDITOR_DURATION_MIN}
            max={CALENDAR_EDITOR_DURATION_MAX}
            onChange={(duration) => setDraft({ ...draft, duration })}
          />
          {durationInvalid ? (
            <p id={EVENT_DURATION_ERROR_ID} className="settings-feedback error" role="alert">
              {validationError}
            </p>
          ) : null}
          <TextInput label="Location" value={draft.location} onChange={(location) => setDraft({ ...draft, location })} />
          <EditorActions
            onSave={() => void saveEvent()}
            onCancel={closeEditor}
            isLoading={isSaving}
            loadingLabel={loadingLabel}
          />
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
              <RowActionButtons
                label={event.title}
                onEdit={() => openEditor(event)}
                onDelete={() => void deleteEvent(event)}
                isDisabled={rowActionsLocked}
                isDeleting={pendingDeleteId === event.id}
              />
            </article>
          ))}
        </div>
      ) : search.trim().length > 0 ? (
        <EmptyState icon={CalendarDays} title="No matches found" body="No events match that search." actionLabel="Clear search" onAction={onClearSearch} />
      ) : (
        <EmptyState icon={CalendarDays} title="No events scheduled" body="Plan classes, study groups, reviews, and exam blocks." actionLabel="Create first event" onAction={() => openEditor()} />
      )}
    </section>
  )
}
