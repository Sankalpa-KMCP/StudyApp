import { useState, useRef, useCallback, useEffect } from 'react'
import { BookOpen } from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
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
import {
  createSubject,
  deleteSubject as deleteSubjectRecord,
  getSubjectLinkedUsage,
  type SubjectLinkedUsage,
  updateSubject,
} from '../db/subjectService'
import type { StudySubject, StudyTask, StudyNote, CalendarEvent, StudySession, SubjectProgressMode } from '../db/types'
import {
  calculateSubjectProgress,
  formatMinutes,
  formatSubjectProgressModeLabel,
} from '../appUtils'
import { useMutationState, type MutationPhase } from '../hooks/useMutationState'
import { validateSubjectEditorDraft } from '../validation/editorDraftValidation'
import {
  SUBJECT_EDITOR_PROGRESS_MAX,
  SUBJECT_EDITOR_PROGRESS_MIN,
  SUBJECT_EDITOR_TARGET_HOURS_MAX,
  SUBJECT_EDITOR_TARGET_HOURS_MIN,
} from '../validation/editorLimits'

const colorSwatches = [
  { value: '#111827', name: 'charcoal' },
  { value: '#2563eb', name: 'blue' },
  { value: '#0f766e', name: 'teal' },
  { value: '#b45309', name: 'amber' },
  { value: '#7c3aed', name: 'violet' },
  { value: '#be123c', name: 'rose' },
  { value: '#475569', name: 'slate' },
  { value: '#047857', name: 'emerald' },
] as const

type SubjectDraft = {
  name: string
  color: string
  targetHours: number
  progress: number
  progressMode: SubjectProgressMode
}

const emptyDraft = (): SubjectDraft => ({
  name: '',
  color: colorSwatches[0].value,
  targetHours: 5,
  progress: 0,
  progressMode: 'manual',
})

const SUBJECT_MODE_HELP_ID = 'subject-progress-mode-help'

export function SubjectsView({
  subjects,
  tasks,
  notes,
  events,
  sessions,
  search = '',
  onClearSearch = () => {},
  openEditorRequest,
  databaseGeneration = 1,
}: {
  subjects: StudySubject[]
  tasks: StudyTask[]
  notes: StudyNote[]
  events: CalendarEvent[]
  sessions: StudySession[]
  openEditorRequest: number
  search?: string
  onClearSearch?: () => void
  databaseGeneration?: number
}) {
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null)
  const [draft, setDraft] = useState<SubjectDraft>(() => emptyDraft())
  const [validationError, setValidationError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [confirmSubject, setConfirmSubject] = useState<StudySubject | null>(null)
  const handledEditorRequest = useRef(0)
  const nameFieldRef = useRef<HTMLInputElement | null>(null)
  const progressModeFieldRef = useRef<HTMLSelectElement | null>(null)
  const editorGenerationRef = useRef(databaseGeneration)
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
    editorGenerationRef.current = databaseGeneration
    setEditingSubjectId(subject?.id ?? 'new')
    setDraft({
      name: subject?.name ?? '',
      color: subject?.color ?? colorSwatches[0].value,
      targetHours: subject?.targetHours ?? 5,
      progress: subject?.progress ?? 0,
      progressMode: subject?.progressMode ?? 'manual',
    })
  }, [clearSaveFeedback, databaseGeneration])

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
    sessions: sessions.filter((session) => session.subjectId === subjectId).length,
  })

  const saveSubject = async () => {
    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()

    const validated = validateSubjectEditorDraft(draft)
    if (!validated.ok) {
      if (validated.reason === 'empty_name') {
        setValidationError('Enter a subject name.')
        return
      }

      setValidationError('Choose a valid progress mode.')
      progressModeFieldRef.current?.focus()
      return
    }

    const isEdit = Boolean(editingSubjectId && editingSubjectId !== 'new')
    const fields = validated.fields

    await runSave(async () => {
      if (isEdit && editingSubjectId) {
        await updateSubject(editingSubjectId, fields, {
          expectedGeneration: editorGenerationRef.current,
        })
        return
      }

      await createSubject(fields, {
        expectedGeneration: editorGenerationRef.current,
      })
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

  const formatSubjectLinkedUsage = (subjectName: string, linked: SubjectLinkedUsage): string => {
    if (linked.activeFocus > 0) {
      return `Cannot delete ${subjectName}. It is linked to ${linked.activeFocus} active focus session, ${linked.tasks} tasks, ${linked.notes} notes, ${linked.events} events, and ${linked.sessions} sessions.`
    }
    return `Cannot delete ${subjectName}. It is linked to ${linked.tasks} tasks, ${linked.notes} notes, ${linked.events} events, and ${linked.sessions} sessions.`
  }

  const requestDeleteSubject = async (subject: StudySubject) => {
    if (pendingDeleteId || isSaving || isRowPending || confirmSubject) return

    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()

    const linked = await getSubjectLinkedUsage(subject.id)
    const linkedTotal = Object.values(linked).reduce((sum, count) => sum + count, 0)
    if (linkedTotal > 0) {
      setValidationError(formatSubjectLinkedUsage(subject.name, linked))
      return
    }

    setConfirmSubject(subject)
  }

  const deleteSubject = async (subject: StudySubject) => {
    if (pendingDeleteId || isSaving || isRowPending) return

    setConfirmSubject(null)
    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()

    setPendingDeleteId(subject.id)
    try {
      await runRow(async () => {
        const result = await deleteSubjectRecord(subject.id, {
          expectedGeneration: databaseGeneration,
        })
        if (!result.ok && result.reason === 'linked') {
          setValidationError(formatSubjectLinkedUsage(subject.name, result.usage))
          throw new Error('Subject is linked to other study records.')
        }
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
              {colorSwatches.map((swatch) => (
                <button
                  className={draft.color === swatch.value ? 'swatch is-active' : 'swatch'}
                  style={{ backgroundColor: swatch.value }}
                  type="button"
                  key={swatch.value}
                  aria-label={`Use ${swatch.name}`}
                  disabled={isSaving}
                  onClick={() => setDraft({ ...draft, color: swatch.value })}
                />
              ))}
            </div>
          </label>
          <label className="field" htmlFor="subject-progress-mode">
            <span>Progress mode</span>
            <select
              id="subject-progress-mode"
              ref={progressModeFieldRef}
              value={draft.progressMode}
              required
              aria-required="true"
              aria-describedby={SUBJECT_MODE_HELP_ID}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, progressMode: event.target.value as SubjectProgressMode })}
            >
              <option value="manual">{formatSubjectProgressModeLabel('manual')}</option>
              <option value="study_time">{formatSubjectProgressModeLabel('study_time')}</option>
            </select>
          </label>
          <p className="settings-feedback" id={SUBJECT_MODE_HELP_ID}>
            {draft.progressMode === 'manual'
              ? 'Update this subject yourself.'
              : 'Calculated automatically from recorded study sessions.'}
          </p>
          <NumberInput
            label="Target hours"
            value={draft.targetHours}
            min={SUBJECT_EDITOR_TARGET_HOURS_MIN}
            max={SUBJECT_EDITOR_TARGET_HOURS_MAX}
            onChange={(targetHours) => setDraft({ ...draft, targetHours })}
          />
          {draft.progressMode === 'manual' ? (
            <NumberInput
              label="Progress %"
              value={draft.progress}
              min={SUBJECT_EDITOR_PROGRESS_MIN}
              max={SUBJECT_EDITOR_PROGRESS_MAX}
              onChange={(progress) => setDraft({ ...draft, progress })}
            />
          ) : null}
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
            const { percentage: progressValue, loggedMinutes: minutes } = calculateSubjectProgress(subject, sessions)
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
                  onDelete={() => void requestDeleteSubject(subject)}
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
      <ConfirmDialog
        open={confirmSubject !== null}
        title="Confirm deletion"
        description={
          confirmSubject
            ? `Delete ${confirmSubject.name}? This subject has no linked records.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setConfirmSubject(null)}
        onConfirm={() => {
          if (!confirmSubject) return
          void deleteSubject(confirmSubject)
        }}
      />
    </section>
  )
}
