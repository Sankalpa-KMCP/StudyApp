import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Square } from 'lucide-react'
import { clamp } from '../appUtils'
import { createId, nowIso, studyDb } from '../db/studyDb'
import type { StudyTask, StudySubject, TaskPriority } from '../db/types'
import { EmptyState, PanelHeader, TextInput, NumberInput, SubjectSelect, SegmentedControl, EditorActions, RowActionButtons } from '../components/ui'

export function TasksView({
  tasks,
  subjects,
  filter,
  openEditorRequest,
  onFilterChange,
}: {
  tasks: StudyTask[]
  subjects: StudySubject[]
  filter: 'all' | 'open' | 'done'
  openEditorRequest: number
  onFilterChange: (filter: 'all' | 'open' | 'done') => void
}) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ title: '', subjectId: '', dueDate: '', priority: 'normal' as TaskPriority, minutes: 30 })
  const handledEditorRequest = useRef(0)

  const openEditor = useCallback((task?: StudyTask) => {
    setEditingTaskId(task?.id ?? 'new')
    setDraft({
      title: task?.title ?? '',
      subjectId: task?.subjectId ?? subjects[0]?.id ?? '',
      dueDate: task?.dueDate ?? '',
      priority: task?.priority ?? 'normal',
      minutes: task?.minutes ?? 30,
    })
  }, [subjects])

  useEffect(() => {
    if (openEditorRequest > handledEditorRequest.current) {
      handledEditorRequest.current = openEditorRequest
      openEditor()
    }
  }, [openEditor, openEditorRequest])

  const saveTask = async () => {
    const title = draft.title.trim()
    if (!title) return
    const timestamp = nowIso()
    if (editingTaskId && editingTaskId !== 'new') {
      await studyDb.tasks.update(editingTaskId, { ...draft, title, minutes: clamp(draft.minutes, 5, 720), updatedAt: timestamp })
    } else {
      await studyDb.tasks.add({
        id: createId('task'),
        title,
        subjectId: draft.subjectId,
        dueDate: draft.dueDate,
        priority: draft.priority,
        status: 'open',
        minutes: clamp(draft.minutes, 5, 720),
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    }
    setEditingTaskId(null)
    setDraft({ title: '', subjectId: subjects[0]?.id ?? '', dueDate: '', priority: 'normal', minutes: 30 })
  }

  return (
    <section className="workspace-panel" aria-labelledby="tasks-workspace-title">
      <PanelHeader title="Tasks" actionLabel="New task" onAction={() => openEditor()} />
      <SegmentedControl<'all' | 'open' | 'done'> value={filter} options={['all', 'open', 'done']} onChange={onFilterChange} />
      {editingTaskId ? (
        <div className="editor-card">
          <TextInput label="Task title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
          <SubjectSelect subjects={subjects} value={draft.subjectId} onChange={(subjectId) => setDraft({ ...draft, subjectId })} />
          <label className="field">
            <span>Priority</span>
            <select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as TaskPriority })}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
          <TextInput label="Due date" type="date" value={draft.dueDate} onChange={(dueDate) => setDraft({ ...draft, dueDate })} />
          <NumberInput label="Minutes" value={draft.minutes} min={5} max={720} onChange={(minutes) => setDraft({ ...draft, minutes })} />
          <EditorActions onSave={() => void saveTask()} onCancel={() => setEditingTaskId(null)} />
        </div>
      ) : null}
      {tasks.length > 0 ? (
        <div className="table-list">
          {tasks.map((task) => (
            <article className={task.status === 'done' ? 'list-row is-done' : 'list-row'} key={task.id}>
              <button
                type="button"
                className="task-check"
                onClick={() => void studyDb.tasks.update(task.id, { status: task.status === 'done' ? 'open' : 'done', updatedAt: nowIso() })}
                aria-label={`Toggle ${task.title}`}
              >
                {task.status === 'done' ? <Check size={14} /> : <Square size={16} />}
              </button>
              <div>
                <h3>{task.title}</h3>
                <p>{task.priority} priority - {task.minutes} min{task.dueDate ? ` - due ${task.dueDate}` : ''}</p>
              </div>
              <RowActionButtons label={task.title} onEdit={() => openEditor(task)} onDelete={() => void studyDb.tasks.delete(task.id)} />
            </article>
          ))}
        </div>
      ) : filter !== 'all' ? (
        <EmptyState
          icon={Check}
          title="No matching tasks"
          body="No tasks match the current filter."
          actionLabel="Clear filter"
          onAction={() => onFilterChange('all')}
        />
      ) : (
        <EmptyState
          icon={Check}
          title="No matching tasks"
          body="Add a task to shape today's queue."
          actionLabel="Create first task"
          onAction={() => openEditor()}
        />
      )}
    </section>
  )
}
