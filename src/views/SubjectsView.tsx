import { useState, useRef, useCallback, useEffect } from 'react'
import { BookOpen } from 'lucide-react'
import {
  PanelHeader,
  TextInput,
  NumberInput,
  EditorActions,
  RowActionButtons,
  EmptyState,
  ProgressBar,
  MutationNotice,
} from '../components/ui'
import { createId, nowIso, studyDb } from '../db/studyDb'
import type { StudySubject, StudyTask, StudyNote, CalendarEvent, Flashcard, StudySession } from '../db/types'
import { clamp, formatMinutes, getSubjectProgress } from '../appUtils'
import { useMutationState, type MutationPhase } from '../hooks/useMutationState'

const colorSwatches = ['#111827', '#2563eb', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#475569', '#047857']

type SubjectDraft = {
  name: string
  color: string
  targetHours: number
  progress: number
}

const emptyDraft = (): SubjectDraft => ({
  name: '',
  color: colorSwatches[0],
  targetHours: 5,
  progress: 0,
})

export function SubjectsView({
  subjects,
  tasks,
  notes,
  events,
  flashcards,
  sessions,
  search = '',
  onClearSearch = () => {},
  openEditorRequest,
}: {
  subjects: StudySubject[]
  tasks: StudyTask[]
  notes: StudyNote[]
  events: CalendarEvent[]
  flashcards: Flashcard[]
  sessions: StudySession[]
  openEditorRequest: number
  search?: string
  onClearSearch?: () => void
}) {
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null)
  const [draft, setDraft] = useState<SubjectDraft>(() => emptyDraft())
  const [validationError, setValidationError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const handledEditorRequest = useRef(0)
  const nameFieldRef = useRef<HTMLInputElement | null>(null)
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

  const openEditor = useCallback((subject?: StudySubject) => {
    setValidationError(null)
    clearSaveFeedback()
    setEditingSubjectId(subject?.id ?? 'new')
    setDraft({
      name: subject?.name ?? '',
      color: subject?.color ?? colorSwatches[0],
      targetHours: subject?.targetHours ?? 5,
      progress: subject?.progress ?? 0,
    })
  }, [clearSaveFeedback])

  useEffect(() => {
    if (openEditorRequest > handledEditorRequest.current) {
      handledEditorRequest.current = openEditorRequest
      openEditor()
    }
  }, [openEditor, openEditorRequest])

  useEffect(() => {
    if (editingSubjectId) nameFieldRef.current?.focus()
  }, [editingSubjectId])

  const closeEditor = useCallback(() => {
    if (isSaving) return
    setEditingSubjectId(null)
    setDraft(emptyDraft())
    setValidationError(null)
  }, [isSaving])

  const dismissNotice = () => {
    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()
  }

  const getLinkedCounts = (subjectId: string) => ({
    tasks: tasks.filter((task) => task.subjectId === subjectId).length,
    notes: notes.filter((note) => note.subjectId === subjectId).length,
    events: events.filter((event) => event.subjectId === subjectId).length,
    flashcards: flashcards.filter((card) => card.subjectId === subjectId).length,
    sessions: sessions.filter((session) => session.subjectId === subjectId).length,
  })

  const saveSubject = async () => {
    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()

    const name = draft.name.trim()
    if (!name) {
      setValidationError('Enter a subject name.')
      return
    }

    const isEdit = Boolean(editingSubjectId && editingSubjectId !== 'new')
    const timestamp = nowIso()
    const payload = {
      name,
      color: draft.color,
      targetHours: clamp(draft.targetHours, 1, 100),
      progress: clamp(draft.progress, 0, 100),
      updatedAt: timestamp,
    }

    await runSave(async () => {
      if (isEdit && editingSubjectId) {
        const updated = await studyDb.subjects.update(editingSubjectId, payload)
        if (updated === 0) throw new Error('Subject no longer exists.')
        return
      }

      await studyDb.subjects.add({ id: createId('subject'), ...payload, createdAt: timestamp })
    }, {
      successMessage: isEdit ? 'Subject updated.' : 'Subject created.',
      errorMessage: 'Subject could not be saved. Your details are still in the form.',
      onSuccess: () => {
        setEditingSubjectId(null)
        setDraft(emptyDraft())
        setValidationError(null)
      },
    })
  }

  const deleteSubject = async (subject: StudySubject) => {
    if (pendingDeleteId || isSaving || isRowPending) return

    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()

    const linked = getLinkedCounts(subject.id)
    const linkedTotal = Object.values(linked).reduce((sum, count) => sum + count, 0)
    if (linkedTotal > 0) {
      setValidationError(
        `Cannot delete ${subject.name}. It is linked to ${linked.tasks} tasks, ${linked.notes} notes, ${linked.events} events, ${linked.flashcards} flashcards, and ${linked.sessions} sessions.`,
      )
      return
    }

    if (!window.confirm(`Delete ${subject.name}? This subject has no linked records.`)) return

    setPendingDeleteId(subject.id)
    try {
      await runRow(async () => {
        await studyDb.subjects.delete(subject.id)
      }, {
        successMessage: 'Subject deleted.',
        errorMessage: 'Subject could not be deleted. Please try again.',
        onSuccess: () => {
          if (editingSubjectId === subject.id) {
            setEditingSubjectId(null)
            setDraft(emptyDraft())
            setValidationError(null)
          }
        },
      })
    } finally {
      setPendingDeleteId(null)
    }
  }

  const loadingLabel = editingSubjectId && editingSubjectId !== 'new' ? 'Saving subject...' : 'Creating subject...'
  const rowActionsLocked = isSaving || Boolean(pendingDeleteId)

  return (
    <section className="workspace-panel" aria-labelledby="subjects-workspace-title">
      <PanelHeader title="Subjects" description="Organize material, targets, and time by subject." actionLabel="New subject" onAction={() => openEditor()} />
      <MutationNotice phase={noticePhase} message={noticeMessage} onDismiss={dismissNotice} />
      {editingSubjectId ? (
        <div className="editor-card" aria-busy={isSaving || undefined}>
          <TextInput label="Subject name" value={draft.name} inputRef={nameFieldRef} onChange={(name) => setDraft({ ...draft, name })} />
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
                  disabled={isSaving}
                  onClick={() => setDraft({ ...draft, color })}
                />
              ))}
            </div>
          </label>
          <NumberInput label="Target hours" value={draft.targetHours} min={1} max={100} onChange={(targetHours) => setDraft({ ...draft, targetHours })} />
          <NumberInput label="Progress %" value={draft.progress} min={0} max={100} onChange={(progress) => setDraft({ ...draft, progress })} />
          <EditorActions
            onSave={() => void saveSubject()}
            onCancel={closeEditor}
            isLoading={isSaving}
            loadingLabel={loadingLabel}
          />
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
                <RowActionButtons
                  label={subject.name}
                  onEdit={() => openEditor(subject)}
                  onDelete={() => void deleteSubject(subject)}
                  confirmDelete={false}
                  isDisabled={rowActionsLocked}
                  isDeleting={pendingDeleteId === subject.id}
                />
              </article>
            )
          })}
        </div>
      ) : search.trim().length > 0 ? (
        <EmptyState icon={BookOpen} title="No matches found" body="No subjects match that search." actionLabel="Clear search" onAction={onClearSearch} />
      ) : (
        <EmptyState icon={BookOpen} title="No subjects yet" body="Create subjects first, then connect tasks, notes, events, and cards." actionLabel="Create first subject" onAction={() => openEditor()} />
      )}
    </section>
  )
}
