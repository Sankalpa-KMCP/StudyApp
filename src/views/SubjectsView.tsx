import { useState, useRef, useCallback, useEffect } from 'react'
import { BookOpen } from 'lucide-react'
import { PanelHeader, TextInput, NumberInput, EditorActions, RowActionButtons, EmptyState, ProgressBar } from '../components/ui'
import { createId, nowIso, studyDb } from '../db/studyDb'
import type { StudySubject, StudyTask, StudyNote, CalendarEvent, Flashcard, StudySession } from '../db/types'
import { clamp, formatMinutes, getSubjectProgress } from '../appUtils'
import type { SettingsFeedback } from '../App'

const colorSwatches = ['#111827', '#2563eb', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#475569', '#047857']

export function SubjectsView({
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
