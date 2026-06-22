import { Check, Target } from 'lucide-react'
import type { CategoryItem, TaskItem } from '../../db/types'
import { useTranslation } from '../../i18n/useTranslation'
import type { TranslationKey } from '../../i18n'
import { SubtaskEditor } from './SubtaskEditor'

const PRIORITY_LABEL_KEYS: Record<'low' | 'medium' | 'high', TranslationKey> = {
  low: 'taskPriorityLow',
  medium: 'taskPriorityMedium',
  high: 'taskPriorityHigh',
}

export interface TaskRowProps {
  task: TaskItem
  completed?: boolean
  isActive: boolean
  category?: CategoryItem
  setActiveTaskId: (id: number | null) => void
  onActivateTask: (task: TaskItem) => void
  toggleTask: (id: number) => Promise<void>
  onAddSubtask: (task: TaskItem, text: string) => Promise<void>
  onToggleSubtask: (task: TaskItem, subId: string) => Promise<void>
  onDeleteSubtask: (task: TaskItem, subId: string) => Promise<void>
}

export function TaskRow({
  task,
  completed = false,
  isActive,
  category,
  setActiveTaskId,
  onActivateTask,
  toggleTask,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: TaskRowProps) {
  const { t } = useTranslation()
  const subtaskCount = task.subtasks?.length ?? 0
  const priorityBorder = task.priority === 'high'
    ? 'border-l-[4px] border-l-[#ff453a]'
    : task.priority === 'medium'
    ? 'border-l-[4px] border-l-[#ff9f0a]'
    : 'border-l-[4px] border-l-accent-blue/40'

  const toggleActive = () => {
    if (task.completed) return
    if (isActive) {
      setActiveTaskId(null)
    } else {
      onActivateTask(task)
    }
  }

  const isInteractive = !completed && !isActive

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget
    if (card.closest('[data-reduce-effects="true"]')) return
    const rect = card.getBoundingClientRect()
    card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
    card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
  }

  return (
    <div
      aria-current={isActive ? 'true' : undefined}
      onMouseMove={isInteractive ? handleMouseMove : undefined}
      className={`dynamic-card flex flex-col gap-3 py-4 px-4 transition-all duration-305 mb-2 ${
        completed
          ? 'opacity-70'
          : isActive
          ? 'shadow-lg border-card -translate-y-[1px] ring-1 ring-accent-blue/25 border-l-[4px] border-l-accent-blue'
          : 'dynamic-card-interactive hover:-translate-y-[2px]'
      } ${completed || isActive ? '' : priorityBorder}`}
    >
      <div className="flex items-center justify-between gap-3.5 w-full">
        <div className="flex items-center gap-3 w-full min-w-0">
          <button
            type="button"
            aria-label={task.completed ? t('taskMarkIncomplete') : t('taskMarkComplete')}
            onClick={() => toggleTask(task.id!)}
            className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all duration-250 ease-out ios-active-scale ${
              task.completed
                ? 'border-accent-green bg-accent-green text-on-accent shadow-sm'
                : 'border-card hover:border-accent-blue hover:surface-subtle'
            }`}
          >
            {task.completed && <Check className="h-3 w-3 stroke-[2.5]" />}
          </button>
          {category && (
            <span
              className="shrink-0 text-[8px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
              style={{ backgroundColor: 'transparent', borderColor: category.color, color: category.color }}
            >
              {category.name}
            </span>
          )}
          {!completed && task.priority && (
            <span className={`shrink-0 text-[8px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
              task.priority === 'high'
                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : task.priority === 'low'
                ? 'bg-accent-blue/10 text-accent-blue border-accent-blue/20'
                : 'bg-transparent text-muted border-card'
            }`}>
              {t(PRIORITY_LABEL_KEYS[task.priority])}
            </span>
          )}
          <span
            title={task.text}
            className={`flex-1 text-xs font-semibold select-none transition-colors ${
              completed
                ? 'text-muted line-through truncate'
                : isActive
                ? 'text-primary line-clamp-2'
                : 'text-secondary truncate'
            }`}
          >
            {task.text}
          </span>
          {!completed && subtaskCount > 0 && !isActive && (
            <span className="shrink-0 text-micro font-bold text-muted surface-subtle border border-card px-2 py-0.5 rounded-full">
              {subtaskCount === 1
                ? t('taskSubtasksOne')
                : t('taskSubtasksMany', { count: subtaskCount })}
            </span>
          )}
        </div>
        {!completed && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={task.completed}
              aria-label={isActive
                ? t('taskDeselect', { task: task.text })
                : t('taskSelectForTimer', { task: task.text })}
              aria-pressed={isActive}
              onClick={toggleActive}
              className={`min-h-9 min-w-9 flex items-center justify-center rounded-full border transition-all ios-active-scale cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                isActive
                  ? 'border-accent-blue bg-accent-blue/15 text-accent-blue'
                  : 'border-card surface-subtle text-muted hover:border-accent-blue/40 hover:text-accent-blue'
              }`}
            >
              <Target className="h-4 w-4" />
            </button>
            <span className="text-micro font-mono font-bold text-secondary flex items-center gap-1 surface-subtle px-2.5 py-1 rounded-full border border-card">
              <span>{task.actualCycles ?? 0}/{task.estimatedCycles ?? 1}</span>
            </span>
          </div>
        )}
      </div>

      {!completed && isActive && subtaskCount === 0 && (
        <p className="pl-8 text-micro text-muted italic">{t('taskAddSubtasksHint')}</p>
      )}

      {!completed && isActive && (
        <SubtaskEditor
          task={task}
          onAddSubtask={onAddSubtask}
          onToggleSubtask={onToggleSubtask}
          onDeleteSubtask={onDeleteSubtask}
        />
      )}
    </div>
  )
}
