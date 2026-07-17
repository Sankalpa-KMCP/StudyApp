import { ChevronDown, ChevronUp } from 'lucide-react'
import type { CategoryItem, TaskItem } from '../../db/types'
import { useTranslation } from '../../i18n/useTranslation'
import { TaskRow, type TaskRowProps } from './TaskRow'

export interface CompletedTasksSectionProps {
  filteredCompleted: TaskItem[]
  visibleCompleted: TaskItem[]
  completedOpen: boolean
  completedVisibleCount: number
  onToggle: () => void
  onShowMore: () => void
  categoriesMap: Map<number, CategoryItem>
  setActiveTaskId: TaskRowProps['setActiveTaskId']
  onActivateTask: TaskRowProps['onActivateTask']
  toggleTask: TaskRowProps['toggleTask']
  onAddSubtask: TaskRowProps['onAddSubtask']
  onToggleSubtask: TaskRowProps['onToggleSubtask']
  onDeleteSubtask: TaskRowProps['onDeleteSubtask']
}

export function CompletedTasksSection({
  filteredCompleted,
  visibleCompleted,
  completedOpen,
  completedVisibleCount,
  onToggle,
  onShowMore,
  categoriesMap,
  setActiveTaskId,
  onActivateTask,
  toggleTask,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: CompletedTasksSectionProps) {
  const { t } = useTranslation()

  if (filteredCompleted.length === 0) return null

  const rowProps = {
    setActiveTaskId,
    onActivateTask,
    toggleTask,
    onAddSubtask,
    onToggleSubtask,
    onDeleteSubtask,
  }

  return (
    <div className="mt-4 border-t border-card pt-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-micro font-bold uppercase tracking-wider text-muted hover:text-primary transition-colors mb-2"
        aria-expanded={completedOpen}
      >
        <span>{t('taskRecentlyCompleted', { count: filteredCompleted.length })}</span>
        {completedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {completedOpen && (
        <div className="flex flex-col">
          {visibleCompleted.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              completed
              isActive={false}
              category={task.categoryId !== undefined ? categoriesMap.get(task.categoryId) : undefined}
              {...rowProps}
            />
          ))}
          {completedVisibleCount < filteredCompleted.length && (
            <button
              type="button"
              onClick={onShowMore}
              className="mt-2 rounded-full border border-card surface-subtle px-4 py-2 text-label font-semibold text-secondary hover:surface-track"
            >
              {t('taskShowMoreRemaining', { count: filteredCompleted.length - completedVisibleCount })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
