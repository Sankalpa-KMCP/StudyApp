import { clamp } from '../appUtils'
import type { StudySubject } from '../db/types'
import type { MutationPhase } from '../hooks/useMutationState'
import { BookOpen, Check, Edit3, Plus, Save, Trash2, X } from 'lucide-react'
import type { Ref } from 'react'

export function SubjectCard({ subject, progressValue = subject.progress }: { subject: StudySubject; progressValue?: number }) {
  return (
    <article className="card subject-card" style={{ '--subject-color': subject.color } as React.CSSProperties}>
      <div className="subject-icon" style={{ backgroundColor: subject.color }}>
        <BookOpen size={21} aria-hidden="true" />
      </div>
      <h3>{subject.name}</h3>
      <p>{subject.targetHours}h target</p>
      <ProgressBar value={progressValue} label={`${Math.round(progressValue)}%`} />
    </article>
  )
}

export function EmptyState({ icon: Icon, title, body, actionLabel, onAction }: { icon: typeof Check; title: string; body: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={24} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      <button className="secondary-command" type="button" onClick={onAction}>{actionLabel}</button>
    </div>
  )
}

export function PanelHeader({ title, description, actionLabel, onAction, actionRef }: { title: string; description: string; actionLabel?: string; onAction?: () => void; actionRef?: Ref<HTMLButtonElement> }) {
  const headingId = `${String(title).toLowerCase()}-workspace-title`
  const ActionIcon = actionLabel?.toLowerCase().startsWith('clear') ? X : Plus
  return (
    <div className="workspace-heading">
      <div>
        <h1 id={headingId}>{title}</h1>
        <p>{description}</p>
      </div>
      {actionLabel && onAction ? (
        <button ref={actionRef} className="primary-command" type="button" onClick={onAction}>
          <ActionIcon size={18} aria-hidden="true" />
          <span>{actionLabel}</span>
        </button>
      ) : null}
    </div>
  )
}

export function TextInput({ label, value, onChange, type = 'text', inputRef }: { label: string; value: string; onChange: (value: string) => void; type?: string; inputRef?: Ref<HTMLInputElement> }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input ref={inputRef} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

export function NumberInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(clamp(Number(event.target.value), min, max))} />
    </label>
  )
}

export function SubjectSelect({ subjects, value, onChange }: { subjects: StudySubject[]; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>Subject</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">General</option>
        {subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}
      </select>
    </label>
  )
}

export function SegmentedControl<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (value: T) => void }) {
  return (
    <div className="segmented-control" role="group" aria-label="Task filter">
      {options.map((option) => (
        <button className={value === option ? 'is-active' : ''} type="button" aria-pressed={value === option} key={option} onClick={() => onChange(option)}>
          {option}
        </button>
      ))}
    </div>
  )
}

export function EditorActions({
  onSave,
  onCancel,
  isLoading = false,
  loadingLabel = 'Saving...',
}: {
  onSave: () => void
  onCancel: () => void
  isLoading?: boolean
  loadingLabel?: string
}) {
  return (
    <div className="editor-actions">
      <button
        className="primary-command"
        type="button"
        onClick={onSave}
        disabled={isLoading}
        aria-busy={isLoading || undefined}
      >
        <Save size={16} aria-hidden="true" />
        {isLoading ? loadingLabel : 'Save'}
      </button>
      <button className="secondary-command" type="button" onClick={onCancel} disabled={isLoading}>
        Cancel
      </button>
    </div>
  )
}

export function MutationNotice({
  phase,
  message,
  onDismiss,
  id,
}: {
  phase: MutationPhase
  message: string | null
  onDismiss?: () => void
  id?: string
}) {
  if (!message || (phase !== 'success' && phase !== 'error')) return null

  const isError = phase === 'error'

  return (
    <div
      className={isError ? 'mutation-notice settings-feedback error' : 'mutation-notice settings-feedback'}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? undefined : 'polite'}
      id={id}
    >
      <p>{message}</p>
      {onDismiss ? (
        <button type="button" className="mutation-notice-dismiss" aria-label="Dismiss notification" onClick={onDismiss}>
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

export function RowActionButtons({
  label,
  onEdit,
  onDelete,
  confirmDelete = true,
  isDisabled = false,
  isDeleting = false,
}: {
  label: string
  onEdit: () => void
  onDelete: () => void
  confirmDelete?: boolean
  isDisabled?: boolean
  isDeleting?: boolean
}) {
  const busy = isDisabled || isDeleting

  const handleDelete = () => {
    if (busy) return
    if (!confirmDelete || window.confirm(`Delete ${label}? This cannot be undone.`)) onDelete()
  }

  return (
    <div className="row-actions">
      <button type="button" aria-label={`Edit ${label}`} onClick={onEdit} disabled={busy}>
        <Edit3 size={16} aria-hidden="true" />
      </button>
      <button
        className="danger-action"
        type="button"
        aria-label={isDeleting ? `Deleting ${label}` : `Delete ${label}`}
        aria-busy={isDeleting || undefined}
        onClick={handleDelete}
        disabled={busy}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

export function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="card metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const boundedValue = clamp(value, 0, 100)
  return (
    <div className="progress-row" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={boundedValue} aria-valuetext={label}>
      <span className="progress-track" aria-hidden="true"><span style={{ width: `${boundedValue}%` }} /></span>
      <strong>{label}</strong>
    </div>
  )
}
