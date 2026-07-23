import { useCallback, useState } from 'react'
import { FileText } from '../components/icons'
import {
  PanelHeader,
  TextInput,
  SubjectSelect,
  EditorActions,
  RowActionButtons,
  EmptyState,
  MutationNotice,
} from '../components/ui'
import { createId, nowIso, studyDb } from '../db/studyDb'
import type { StudyNote, StudySubject } from '../db/types'
import { formatDate, parseTags } from '../appUtils'
import { useMutationState, type MutationPhase } from '../hooks/useMutationState'

type NoteDraft = {
  title: string
  body: string
  subjectId: string
  tags: string
}

const emptyDraft = (subjectId = ''): NoteDraft => ({
  title: '',
  body: '',
  subjectId,
  tags: '',
})

export function NotesView({
  notes,
  subjects,
  subjectMap,
  search = '',
  onClearSearch = () => {},
}: {
  notes: StudyNote[]
  subjects: StudySubject[]
  subjectMap: Map<string, StudySubject>
  search?: string
  onClearSearch?: () => void
}) {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [draft, setDraft] = useState<NoteDraft>(() => emptyDraft())
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

  const openEditor = useCallback((note?: StudyNote) => {
    setValidationError(null)
    clearSaveFeedback()
    setEditingNoteId(note?.id ?? 'new')
    setDraft({
      title: note?.title ?? '',
      body: note?.body ?? '',
      subjectId: note?.subjectId ?? subjects[0]?.id ?? '',
      tags: note?.tags.join(', ') ?? '',
    })
  }, [clearSaveFeedback, subjects])

  const closeEditor = useCallback(() => {
    if (isSaving) return
    setEditingNoteId(null)
    setDraft(emptyDraft(subjects[0]?.id ?? ''))
    setValidationError(null)
  }, [isSaving, subjects])

  const dismissNotice = () => {
    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()
  }

  const saveNote = async () => {
    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()

    const title = draft.title.trim()
    if (!title) {
      setValidationError('Enter a note title.')
      return
    }

    const isEdit = Boolean(editingNoteId && editingNoteId !== 'new')
    const timestamp = nowIso()
    const payload = {
      title,
      body: draft.body.trim(),
      subjectId: draft.subjectId,
      tags: parseTags(draft.tags),
      updatedAt: timestamp,
    }

    await runSave(async () => {
      if (isEdit && editingNoteId) {
        const updated = await studyDb.notes.update(editingNoteId, payload)
        if (updated === 0) throw new Error('Note no longer exists.')
        return
      }

      await studyDb.notes.add({ id: createId('note'), ...payload, createdAt: timestamp })
    }, {
      successMessage: isEdit ? 'Note updated.' : 'Note created.',
      errorMessage: 'Note could not be saved. Your text is still available.',
      onSuccess: () => {
        setEditingNoteId(null)
        setDraft(emptyDraft(subjects[0]?.id ?? ''))
        setValidationError(null)
      },
    })
  }

  const deleteNote = async (note: StudyNote) => {
    if (pendingDeleteId || isSaving || isRowPending) return

    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()
    setPendingDeleteId(note.id)

    try {
      await runRow(async () => {
        await studyDb.notes.delete(note.id)
      }, {
        successMessage: 'Note deleted.',
        errorMessage: 'Note could not be deleted.',
        onSuccess: () => {
          if (editingNoteId === note.id) {
            setEditingNoteId(null)
            setDraft(emptyDraft(subjects[0]?.id ?? ''))
            setValidationError(null)
          }
        },
      })
    } finally {
      setPendingDeleteId(null)
    }
  }

  const loadingLabel = editingNoteId && editingNoteId !== 'new' ? 'Saving note...' : 'Creating note...'
  const rowActionsLocked = isSaving || Boolean(pendingDeleteId)

  return (
    <section className="workspace-panel" aria-labelledby="notes-workspace-title">
      <PanelHeader title="Notes" description="Keep study notes searchable and close to the work." actionLabel="New note" onAction={() => openEditor()} />
      <MutationNotice phase={noticePhase} message={noticeMessage} onDismiss={dismissNotice} />
      {editingNoteId ? (
        <div className="editor-card note-editor" aria-busy={isSaving || undefined}>
          <TextInput label="Note title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
          <SubjectSelect subjects={subjects} value={draft.subjectId} onChange={(subjectId) => setDraft({ ...draft, subjectId })} />
          <TextInput label="Tags" value={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} />
          <label className="field field-full">
            <span>Body</span>
            <textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} rows={6} disabled={isSaving} />
          </label>
          <EditorActions
            onSave={() => void saveNote()}
            onCancel={closeEditor}
            isLoading={isSaving}
            loadingLabel={loadingLabel}
          />
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
              <RowActionButtons
                label={note.title}
                onEdit={() => openEditor(note)}
                onDelete={() => void deleteNote(note)}
                isDisabled={rowActionsLocked}
                isDeleting={pendingDeleteId === note.id}
              />
            </article>
          ))}
        </div>
      ) : search.trim().length > 0 ? (
        <EmptyState icon={FileText} title="No matches found" body="No notes match that search." actionLabel="Clear search" onAction={onClearSearch} />
      ) : (
        <EmptyState icon={FileText} title="No notes yet" body="Capture summaries, formulas, and review prompts in your local database." actionLabel="Create first note" onAction={() => openEditor()} />
      )}
    </section>
  )
}
