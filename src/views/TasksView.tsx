import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Square } from '../components/icons'
import {
  clampTaskEditorMinutes,
  TASK_EDITOR_MINUTES_MAX,
  TASK_EDITOR_MINUTES_MIN,
} from '../validation/editorLimits'
import {
  createTask,
  deleteTask as deleteTaskRecord,
  setTaskStatus,
  updateTask,
} from '../db/taskService'
import type { DatabaseMutationContext } from '../db/databaseMutationGuard'
import type { StudyTask, StudySubject, TaskPriority } from '../db/types'
import { useMutationState, type MutationPhase } from '../hooks/useMutationState'
import {
  EmptyState,
  PanelHeader,
  TextInput,
  NumberInput,
  SubjectSelect,
  SegmentedControl,
  EditorActions,
  RowActionButtons,
  MutationNotice,
} from '../components/ui'

type TaskDraft = {
  title: string
  subjectId: string
  dueDate: string
  priority: TaskPriority
  minutes: number
}

const emptyDraft = (subjectId = ''): TaskDraft => ({
  title: '',
  subjectId,
  dueDate: '',
  priority: 'normal',
  minutes: 30,
})

export function TasksView({
  tasks,
  subjects,
  filter,
  search = '',
  onClearSearch = () => {},
  openEditorRequest,
  onFilterChange,
  databaseGeneration = 1,
}: {
  tasks: StudyTask[]
  subjects: StudySubject[]
  filter: 'all' | 'open' | 'done'
  search: string
  onClearSearch: () => void
  openEditorRequest: number
  onFilterChange: (filter: 'all' | 'open' | 'done') => void
  databaseGeneration?: number
}) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TaskDraft>(() => emptyDraft())
  const [validationError, setValidationError] = useState<string | null>(null)
  const [pendingRowId, setPendingRowId] = useState<string | null>(null)
  const [pendingRowKind, setPendingRowKind] = useState<'status' | 'delete' | null>(null)
  const handledEditorRequest = useRef(0)
  const titleFieldRef = useRef<HTMLInputElement | null>(null)
  const editorGenerationRef = useRef(databaseGeneration)
  const saveMutation = useMutationState()
  const rowMutation = useMutationState()
  const { clearFeedback: clearSaveFeedback, isPending: isSaving, phase: savePhase, message: saveMessage, run: runSave } = saveMutation
  const { clearFeedback: clearRowFeedback, phase: rowPhase, message: rowMessage, run: runRow } = rowMutation

  const noticePhase: MutationPhase = savePhase === 'success' || savePhase === 'error'
    ? savePhase
    : rowPhase === 'success' || rowPhase === 'error'
      ? rowPhase
      : 'idle'
  const noticeMessage = (savePhase === 'success' || savePhase === 'error' ? saveMessage : null)
    ?? (rowPhase === 'success' || rowPhase === 'error' ? rowMessage : null)
  const titleErrorId = 'task-title-error'
  const titleInvalid = validationError === 'Enter a task title.'

  const openEditor = useCallback((task?: StudyTask) => {
    setValidationError(null)
    clearSaveFeedback()
    editorGenerationRef.current = databaseGeneration
    setEditingTaskId(task?.id ?? 'new')
    setDraft({
      title: task?.title ?? '',
      subjectId: task?.subjectId ?? subjects[0]?.id ?? '',
      dueDate: task?.dueDate ?? '',
      priority: task?.priority ?? 'normal',
      minutes: task?.minutes ?? 30,
    })
  }, [clearSaveFeedback, databaseGeneration, subjects])

  useEffect(() => {
    if (openEditorRequest > handledEditorRequest.current) {
      handledEditorRequest.current = openEditorRequest
      openEditor()
    }
  }, [openEditor, openEditorRequest])

  useEffect(() => {
    if (editingTaskId) titleFieldRef.current?.focus()
  }, [editingTaskId])

  const closeEditor = useCallback(() => {
    if (isSaving) return
    setEditingTaskId(null)
    setDraft(emptyDraft(subjects[0]?.id ?? ''))
    setValidationError(null)
  }, [isSaving, subjects])

  const dismissNotice = () => {
    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()
  }

  const saveTask = async () => {
    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()

    const title = draft.title.trim()
    if (!title) {
      setValidationError('Enter a task title.')
      titleFieldRef.current?.focus()
      return
    }

    const isEdit = Boolean(editingTaskId && editingTaskId !== 'new')
    const minutes = clampTaskEditorMinutes(draft.minutes)
    const fields = {
      title,
      subjectId: draft.subjectId,
      dueDate: draft.dueDate,
      priority: draft.priority,
      minutes,
    }

    await runSave(async () => {
      if (isEdit && editingTaskId) {
        await updateTask(editingTaskId, fields, {
          expectedGeneration: editorGenerationRef.current,
        })
        return
      }

      await createTask(fields, {
        expectedGeneration: editorGenerationRef.current,
      })
    }, {
      successMessage: isEdit ? 'Task updated.' : 'Task created.',
      errorMessage: 'Task could not be saved. Your details are still in the form.',
      onSuccess: () => {
        setEditingTaskId(null)
        setDraft(emptyDraft(subjects[0]?.id ?? ''))
        setValidationError(null)
      },
    })
  }

  const toggleTaskStatus = async (task: StudyTask) => {
    if (pendingRowId || isSaving) return

    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()
    setPendingRowId(task.id)
    setPendingRowKind('status')

    const nextStatus = task.status === 'done' ? 'open' : 'done'
    const successMessage = nextStatus === 'done' ? 'Task marked complete.' : 'Task reopened.'
    const errorMessage = nextStatus === 'done'
      ? 'Task could not be marked complete.'
      : 'Task could not be reopened.'

    try {
      await runRow(async () => {
        await setTaskStatus(task.id, nextStatus, {
          expectedGeneration: databaseGeneration,
        })
      }, {
        successMessage,
        errorMessage,
      })
    } finally {
      setPendingRowId(null)
      setPendingRowKind(null)
    }
  }

  const deleteTask = async (task: StudyTask, context?: DatabaseMutationContext) => {
    if (pendingRowId || isSaving) return

    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()
    setPendingRowId(task.id)
    setPendingRowKind('delete')

    try {
      await runRow(async () => {
        await deleteTaskRecord(task.id, {
          expectedGeneration: context?.expectedGeneration ?? databaseGeneration,
        })
      }, {
        successMessage: 'Task deleted.',
        errorMessage: 'Task could not be deleted. Please try again.',
      })
    } finally {
      setPendingRowId(null)
      setPendingRowKind(null)
    }
  }

  const loadingLabel = editingTaskId && editingTaskId !== 'new' ? 'Saving task...' : 'Creating task...'

  return (
    <section className="workspace-panel" aria-labelledby="tasks-workspace-title">
      <PanelHeader
        title="Tasks"
        description="Plan the work that deserves your attention."
        actionLabel="New task"
        onAction={() => openEditor()}
      />
      <MutationNotice phase={noticePhase} message={noticeMessage} onDismiss={dismissNotice} />
      <SegmentedControl<'all' | 'open' | 'done'> value={filter} options={['all', 'open', 'done']} onChange={onFilterChange} />
      {editingTaskId ? (
        <div className="editor-card" aria-busy={isSaving || undefined}>
          <TextInput
            id="task-title"
            label="Task title"
            value={draft.title}
            inputRef={titleFieldRef}
            invalid={titleInvalid}
            describedBy={titleInvalid ? titleErrorId : undefined}
            onChange={(title) => setDraft({ ...draft, title })}
          />
          {titleInvalid ? (
            <p id={titleErrorId} className="settings-feedback error" role="alert">
              {validationError}
            </p>
          ) : null}
          <SubjectSelect subjects={subjects} value={draft.subjectId} onChange={(subjectId) => setDraft({ ...draft, subjectId })} />
          <label className="field">
            <span>Priority</span>
            <select
              value={draft.priority}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, priority: event.target.value as TaskPriority })}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
          <TextInput label="Due date" type="date" value={draft.dueDate} onChange={(dueDate) => setDraft({ ...draft, dueDate })} />
          <NumberInput label="Minutes" value={draft.minutes} min={TASK_EDITOR_MINUTES_MIN} max={TASK_EDITOR_MINUTES_MAX} onChange={(minutes) => setDraft({ ...draft, minutes })} />
          <EditorActions
            onSave={() => void saveTask()}
            onCancel={closeEditor}
            isLoading={isSaving}
            loadingLabel={loadingLabel}
          />
        </div>
      ) : null}
      {tasks.length > 0 ? (
        <div className="table-list">
          {tasks.map((task) => {
            const rowBusy = pendingRowId === task.id
            const isDeleting = rowBusy && pendingRowKind === 'delete'
            const isStatusPending = rowBusy && pendingRowKind === 'status'

            return (
              <article className={task.status === 'done' ? 'list-row is-done' : 'list-row'} key={task.id}>
                <button
                  type="button"
                  className="task-check"
                  onClick={() => void toggleTaskStatus(task)}
                  aria-label={isStatusPending ? `Updating ${task.title}` : `Toggle ${task.title}`}
                  aria-busy={isStatusPending || undefined}
                  disabled={rowBusy || isSaving}
                >
                  {task.status === 'done' ? <Check size={14} aria-hidden="true" /> : <Square size={16} aria-hidden="true" />}
                </button>
                <div>
                  <h3>{task.title}</h3>
                  <p>{task.priority} priority - {task.minutes} min{task.dueDate ? ` - due ${task.dueDate}` : ''}</p>
                </div>
                <RowActionButtons
                  label={task.title}
                  onEdit={() => openEditor(task)}
                  onDelete={(context) => void deleteTask(task, context)}
                  databaseGeneration={databaseGeneration}
                  isDisabled={rowBusy || isSaving}
                  isDeleting={isDeleting}
                />
              </article>
            )
          })}
        </div>
      ) : filter !== 'all' ? (
        <EmptyState
          icon={Check}
          title="No tasks in this view"
          body="No tasks match the current filter."
          actionLabel="Clear filter"
          onAction={() => onFilterChange('all')}
        />
      ) : search.trim().length > 0 ? (
        <EmptyState
          icon={Check}
          title="No matches found"
          body="No tasks match that search."
          actionLabel="Clear search"
          onAction={onClearSearch}
        />
      ) : (
        <EmptyState
          icon={Check}
          title="No tasks yet"
          body="Add a task to shape today's queue."
          actionLabel="Create first task"
          onAction={() => openEditor()}
        />
      )}
    </section>
  )
}
