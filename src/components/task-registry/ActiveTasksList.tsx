import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { CategoryItem, TaskItem } from '../../db/types'
import { useTranslation } from '../../i18n/useTranslation'
import { TaskRow, type TaskRowProps } from './TaskRow'

const VIRTUALIZE_THRESHOLD = 100
const TASK_ROW_ESTIMATE = 140

export interface ActiveTasksListProps {
  tasks: TaskItem[]
  categoriesMap: Map<number, CategoryItem>
  activeTaskId: number | null
  setActiveTaskId: TaskRowProps['setActiveTaskId']
  onActivateTask: TaskRowProps['onActivateTask']
  toggleTask: TaskRowProps['toggleTask']
  onAddSubtask: TaskRowProps['onAddSubtask']
  onToggleSubtask: TaskRowProps['onToggleSubtask']
  onDeleteSubtask: TaskRowProps['onDeleteSubtask']
}

export function ActiveTasksList({
  tasks,
  categoriesMap,
  activeTaskId,
  setActiveTaskId,
  onActivateTask,
  toggleTask,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: ActiveTasksListProps) {
  const { t } = useTranslation()
  const listRef = useRef<HTMLDivElement>(null)
  const shouldVirtualize = tasks.length > VIRTUALIZE_THRESHOLD

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => TASK_ROW_ESTIMATE,
    overscan: 5,
    enabled: shouldVirtualize,
  })

  const rowProps = {
    setActiveTaskId,
    onActivateTask,
    toggleTask,
    onAddSubtask,
    onToggleSubtask,
    onDeleteSubtask,
  }

  const renderRow = (task: TaskItem) => (
    <TaskRow
      key={task.id}
      task={task}
      isActive={activeTaskId === task.id}
      category={task.categoryId !== undefined ? categoriesMap.get(task.categoryId) : undefined}
      {...rowProps}
    />
  )

  return (
    <div
      ref={listRef}
      role="list"
      aria-label={t('taskActiveTargetsListAria')}
      className={`flex flex-col ${shouldVirtualize ? 'max-h-[60vh] overflow-y-auto custom-scrollbar' : ''}`}
    >
      {shouldVirtualize ? (
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map(virtualRow => {
            const task = tasks[virtualRow.index]
            return (
              <div
                key={task.id ?? virtualRow.key}
                role="listitem"
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {renderRow(task)}
              </div>
            )
          })}
        </div>
      ) : (
        tasks.map(task => (
          <div key={task.id} role="listitem">
            {renderRow(task)}
          </div>
        ))
      )}
    </div>
  )
}
