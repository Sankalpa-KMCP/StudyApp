import { Check } from 'lucide-react'
import type { TaskItem } from '../../db/types'
import { useTranslation } from '../../i18n/useTranslation'

export interface SubtaskEditorProps {
  task: TaskItem
  onAddSubtask: (task: TaskItem, text: string) => Promise<void>
  onToggleSubtask: (task: TaskItem, subId: string) => Promise<void>
  onDeleteSubtask: (task: TaskItem, subId: string) => Promise<void>
}

export function SubtaskEditor({
  task,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: SubtaskEditorProps) {
  const { t } = useTranslation()
  const subtaskCount = task.subtasks?.length ?? 0

  return (
    <div data-subtask-panel className="pl-8 pr-2 pt-2.5 border-t border-card space-y-3 cursor-default">
      {subtaskCount > 0 && (
        <div className="space-y-2">
          {task.subtasks!.map(sub => (
            <div key={sub.id} className="flex items-center gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => onToggleSubtask(task, sub.id)}
                className={`h-4 w-4 shrink-0 rounded flex items-center justify-center transition-all cursor-pointer ${
                  sub.completed
                    ? 'border-accent-green bg-accent-green text-on-accent'
                    : 'border-card hover:border-accent-blue surface-subtle'
                }`}
              >
                {sub.completed && <Check className="h-2.5 w-2.5 stroke-[3]" />}
              </button>
              <span className={`flex-1 truncate ${sub.completed ? 'text-muted line-through' : 'text-secondary'}`}>
                {sub.text}
              </span>
              <button
                type="button"
                aria-label={t('taskDeleteSubtask', { text: sub.text })}
                onClick={() => onDeleteSubtask(task, sub.id)}
                className="text-micro text-muted hover:text-red-400 font-bold transition-colors cursor-pointer pl-1 pr-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={t('taskAddSubtaskPlaceholder')}
          className="flex-1 surface-subtle border border-card rounded-lg px-2.5 py-1.5 text-micro text-primary placeholder:text-muted outline-none"
          onKeyDown={async e => {
            if (e.key === 'Enter') {
              const target = e.target as HTMLInputElement
              const text = target.value.trim()
              if (text) {
                await onAddSubtask(task, text)
                target.value = ''
              }
            }
          }}
        />
      </div>
    </div>
  )
}
