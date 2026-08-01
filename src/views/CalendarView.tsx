import { useCallback, useState } from 'react'
import { CalendarDays } from 'lucide-react'
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
import { createId, nowIso, studyDb } from '../db/studyDb'
import type { CalendarEvent, StudySubject } from '../db/types'
import { formatDateTime, parseLocalDateTime, todayInputValue, toInputDate, toInputTime } from '../appUtils'
import { CalendarStrip } from '../components/CalendarStrip'
import { useMutationState, type MutationPhase } from '../hooks/useMutationState'

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
  search = '',
  onClearSearch = () => {},
}: {
  events: CalendarEvent[]
  subjects: StudySubject[]
  subjectMap: Map<string, StudySubject>
  search?: string
  onClearSearch?: () => void
}) {
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EventDraft>(() => emptyDraft())
  const [validationError, setValidationError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const saveMutation = useMutationState()
  const rowMutation = useMutationState()
  const { clearFeedback: clearSaveFeedback, isPending: isSaving, phase: savePhase, message: saveMessage, run: runSave } = saveMutation
  const { clearFeedback: clearRowFeedback, isPending: isRowPending, phase: rowPhase, message: rowMessage, run: runRow } = rowMutation

  const noticePhase: MutationPhase = validationError
    ? 'error'
    : savePhase === 'success' || savePhase === 'error'
      ? savePhase
      : rowPhase === 'success' || rowPhase === 'error'
        ? rowPhase
        : 'idle'
  const noticeMessage = validationError
    ?? (savePhase === 'success' || savePhase === 'error' ? saveMessage : null)
    ?? (rowPhase === 'success' || rowPhase === 'error' ? rowMessage : null)

  const openEditor = useCallback((event?: CalendarEvent) => {
    setValidationError(null)
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
          ? Math.max(15, Math.round((end.getTime() - start.getTime()) / 60_000))
          : 60,
        location: event.location ?? '',
      })
      return
    }

    setEditingEventId('new')
    setDraft(emptyDraft(subjects[0]?.id ?? ''))
  }, [clearSaveFeedback, subjects])

  const closeEditor = useCallback(() => {
    if (isSaving) return
    setEditingEventId(null)
    setDraft(emptyDraft(subjects[0]?.id ?? ''))
    setValidationError(null)
  }, [isSaving, subjects])

  const dismissNotice = () => {
    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()
  }

  const saveEvent = async () => {
    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()

    const title = draft.title.trim()
    if (!title) {
      setValidationError('Enter an event title.')
      return
    }

    const startedAt = parseLocalDateTime(draft.date, draft.time)
    if (!startedAt) {
      setValidationError('Enter a valid date and start time.')
      return
    }

    if (!Number.isFinite(draft.duration) || draft.duration < 15) {
      setValidationError('Duration must be at least 15 minutes.')
      return
    }

    const isEdit = Boolean(editingEventId && editingEventId !== 'new')
    const timestamp = nowIso()
    const startAt = startedAt.toISOString()
    const payload = {
      title,
      subjectId: draft.subjectId,
      startAt,
      endAt: new Date(startedAt.getTime() + draft.duration * 60_000).toISOString(),
      location: draft.location.trim(),
      updatedAt: timestamp,
    }

    await runSave(async () => {
      if (isEdit && editingEventId) {
        const updated = await studyDb.events.update(editingEventId, payload)
        if (updated === 0) throw new Error('Event no longer exists.')
        return
      }

      await studyDb.events.add({ id: createId('event'), ...payload, createdAt: timestamp })
    }, {
      successMessage: isEdit ? 'Event updated.' : 'Event created.',
      errorMessage: 'Event could not be saved. Check the details and try again.',
      onSuccess: () => {
        setEditingEventId(null)
        setDraft(emptyDraft(subjects[0]?.id ?? ''))
        setValidationError(null)
      },
    })
  }

  const deleteEvent = async (event: CalendarEvent) => {
    if (pendingDeleteId || isSaving || isRowPending) return

    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()
    setPendingDeleteId(event.id)

    try {
      await runRow(async () => {
        await studyDb.events.delete(event.id)
      }, {
        successMessage: 'Event deleted.',
        errorMessage: 'Event could not be deleted. Please try again.',
        onSuccess: () => {
          if (editingEventId === event.id) {
            setEditingEventId(null)
            setDraft(emptyDraft(subjects[0]?.id ?? ''))
            setValidationError(null)
          }
        },
      })
    } finally {
      setPendingDeleteId(null)
    }
  }

  const loadingLabel = editingEventId && editingEventId !== 'new' ? 'Saving event...' : 'Creating event...'
  const rowActionsLocked = isSaving || Boolean(pendingDeleteId)

  return (
    <section className="workspace-panel" aria-labelledby="calendar-workspace-title">
      <PanelHeader title="Calendar" description="Schedule classes, study blocks, and deadlines." actionLabel="New event" onAction={() => openEditor()} />
      <MutationNotice phase={noticePhase} message={noticeMessage} onDismiss={dismissNotice} />
      <CalendarStrip events={events} />
      {editingEventId ? (
        <div className="editor-card" aria-busy={isSaving || undefined}>
          <TextInput label="Event title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
          <SubjectSelect subjects={subjects} value={draft.subjectId} onChange={(subjectId) => setDraft({ ...draft, subjectId })} />
          <TextInput label="Date" type="date" value={draft.date} onChange={(date) => setDraft({ ...draft, date })} />
          <TextInput label="Time" type="time" value={draft.time} onChange={(time) => setDraft({ ...draft, time })} />
          <NumberInput label="Duration" value={draft.duration} min={15} max={480} onChange={(duration) => setDraft({ ...draft, duration })} />
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
