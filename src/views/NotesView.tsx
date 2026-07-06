import { useState } from 'react'
import { FileText } from 'lucide-react'
import { PanelHeader, TextInput, SubjectSelect, EditorActions, RowActionButtons, EmptyState } from '../components/ui'
import { createId, nowIso, studyDb } from '../db/studyDb'
import type { StudyNote, StudySubject } from '../db/types'
import { formatDate, parseTags } from '../appUtils'

export function NotesView({ notes, subjects, subjectMap }: { notes: StudyNote[]; subjects: StudySubject[]; subjectMap: Map<string, StudySubject> }) {
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
