import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { PanelHeader, TextInput, NumberInput, SubjectSelect, EditorActions, RowActionButtons, EmptyState } from '../components/ui'
import { createId, nowIso, studyDb } from '../db/studyDb'
import type { CalendarEvent, StudySubject } from '../db/types'
import { formatDateTime, todayInputValue, toInputDate, toInputTime } from '../appUtils'
import { CalendarStrip } from '../components/CalendarStrip'

export function CalendarView({ events, subjects, subjectMap, search = '', onClearSearch = () => {} }: { events: CalendarEvent[]; subjects: StudySubject[]; subjectMap: Map<string, StudySubject>; search?: string; onClearSearch?: () => void }) {
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
      <PanelHeader title="Calendar" description="Schedule classes, study blocks, and deadlines." actionLabel="New event" onAction={() => openEditor()} />
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
      ) : search.trim().length > 0 ? (
        <EmptyState icon={CalendarDays} title="No matches found" body="No events match that search." actionLabel="Clear search" onAction={onClearSearch} />
      ) : (
        <EmptyState icon={CalendarDays} title="No events scheduled" body="Plan classes, study groups, reviews, and exam blocks." actionLabel="Create first event" onAction={() => openEditor()} />
      )}
    </section>
  )
}
