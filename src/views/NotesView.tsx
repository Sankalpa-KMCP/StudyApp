import { useCallback, useEffect, useRef, useState } from 'react'
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
import { createNote, deleteNote as deleteNoteRecord, updateNote } from '../db/notesService'
import type { DatabaseMutationContext } from '../db/databaseMutationGuard'
import type { StudyNote, StudySubject } from '../db/types'
import { formatDate } from '../appUtils'
import { useMutationState, type MutationPhase } from '../hooks/useMutationState'
import { validateNoteEditorDraft } from '../validation/editorDraftValidation'

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
  openEditorRequest = 0,
  search = '',
  onClearSearch = () => {},
  databaseGeneration = 1,
}: {
  notes: StudyNote[]
  subjects: StudySubject[]
  subjectMap: Map<string, StudySubject>
  openEditorRequest?: number
  search?: string
  onClearSearch?: () => void
  databaseGeneration?: number
}) {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [draft, setDraft] = useState<NoteDraft>(() => emptyDraft())
  const [validationError, setValidationError] = useState<{ reason: 'empty_title' | null, message: string | null }>({ reason: null, message: null })
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const handledEditorRequest = useRef(0)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const editorGenerationRef = useRef(databaseGeneration)
  const saveMutation = useMutationState()
  const rowMutation = useMutationState()
  const { clearFeedback: clearSaveFeedback, isPending: isSaving, phase: savePhase, message: saveMessage, run: runSave } = saveMutation
  const { clearFeedback: clearRowFeedback, isPending: isRowPending, phase: rowPhase, message: rowMessage, run: runRow } = rowMutation

  const noticePhase: MutationPhase = validationError.message
    ? 'error'
    : savePhase === 'success' || savePhase === 'error'
      ? savePhase
      : rowPhase === 'success' || rowPhase === 'error'
        ? rowPhase
        : 'idle'
  const noticeMessage = validationError.message
    ?? (savePhase === 'success' || savePhase === 'error' ? saveMessage : null)
    ?? (rowPhase === 'success' || rowPhase === 'error' ? rowMessage : null)

  const openEditor = useCallback((note?: StudyNote) => {
    setValidationError({ reason: null, message: null })
    clearSaveFeedback()
    editorGenerationRef.current = databaseGeneration
    setEditingNoteId(note?.id ?? 'new')
    setDraft({
      title: note?.title ?? '',
      body: note?.body ?? '',
      subjectId: note?.subjectId ?? subjects[0]?.id ?? '',
      tags: note?.tags.join(', ') ?? '',
    })
  }, [clearSaveFeedback, databaseGeneration, subjects])

  useEffect(() => {
    if (openEditorRequest > handledEditorRequest.current) {
      handledEditorRequest.current = openEditorRequest
      openEditor()
    }
  }, [openEditor, openEditorRequest])

  const closeEditor = useCallback(() => {
    if (isSaving) return
    setEditingNoteId(null)
    setDraft(emptyDraft(subjects[0]?.id ?? ''))
    setValidationError({ reason: null, message: null })
  }, [isSaving, subjects])

  const dismissNotice = () => {
    setValidationError({ reason: null, message: null })
    clearSaveFeedback()
    clearRowFeedback()
  }

  const saveNote = async () => {
    setValidationError({ reason: null, message: null })
    clearSaveFeedback()
    clearRowFeedback()

    const validated = validateNoteEditorDraft(draft)
    if (!validated.ok) {
      setValidationError({ reason: validated.reason, message: 'Enter a note title.' })
      requestAnimationFrame(() => {
        if (validated.reason === 'empty_title') titleInputRef.current?.focus()
      })
      return
    }

    const isEdit = Boolean(editingNoteId && editingNoteId !== 'new')
    const fields = validated.fields

    await runSave(async () => {
      if (isEdit && editingNoteId) {
        await updateNote(editingNoteId, fields, {
          expectedGeneration: editorGenerationRef.current,
        })
        return
      }

      await createNote(fields, {
        expectedGeneration: editorGenerationRef.current,
      })
    }, {
      successMessage: isEdit ? 'Note updated.' : 'Note created.',
      errorMessage: 'Note could not be saved. Your text is still available.',
      onSuccess: () => {
        setEditingNoteId(null)
        setDraft(emptyDraft(subjects[0]?.id ?? ''))
        setValidationError({ reason: null, message: null })
      },
    })
  }

  const deleteNote = async (note: StudyNote, context?: DatabaseMutationContext) => {
    if (pendingDeleteId || isSaving || isRowPending) return

    setValidationError({ reason: null, message: null })
    clearSaveFeedback()
    clearRowFeedback()
    setPendingDeleteId(note.id)

    try {
      await runRow(async () => {
        await deleteNoteRecord(note.id, {
          expectedGeneration: context?.expectedGeneration ?? databaseGeneration,
        })
      }, {
        successMessage: 'Note deleted.',
        errorMessage: 'Note could not be deleted.',
        onSuccess: () => {
          if (editingNoteId === note.id) {
            setEditingNoteId(null)
            setDraft(emptyDraft(subjects[0]?.id ?? ''))
            setValidationError({ reason: null, message: null })
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
      <MutationNotice id="mutation-notice-message" phase={noticePhase} message={noticeMessage} onDismiss={dismissNotice} />
      {editingNoteId ? (
        <div className="editor-card note-editor" aria-busy={isSaving || undefined}>
          <TextInput
            label="Note title"
            value={draft.title}
            onChange={(title) => setDraft({ ...draft, title })}
            inputRef={titleInputRef}
            invalid={validationError.reason === 'empty_title'}
            describedBy={validationError.reason === 'empty_title' ? 'mutation-notice-message' : undefined}
          />
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
                onDelete={(context) => void deleteNote(note, context)}
                databaseGeneration={databaseGeneration}
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
