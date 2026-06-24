import { useState } from 'react'
import { AlertCircle, Plus } from 'lucide-react'
import { EmptyState } from '../shared/EmptyState'
import type { CategoryItem, TaskItem, SubTask } from '../../db/types'
import { useTranslation } from '../../i18n/useTranslation'
import { ActiveTasksList } from './ActiveTasksList'
import { CompletedTasksSection } from './CompletedTasksSection'
import { ReviewQueueSection } from './ReviewQueueSection'

const COMPLETED_SECTION_KEY = 'completed_section_open'
const COMPLETED_DISPLAY_CAP = 20

interface TaskListProps {
  activeTasksList: TaskItem[]
  reviewQueueList: TaskItem[]
  completedTasksList: TaskItem[]
  categoriesMap: Map<number, CategoryItem>
  activeTaskId: number | null
  setActiveTaskId: (id: number | null) => void
  onActivateTask: (task: TaskItem) => void
  toggleTask: (id: number) => Promise<void>
  updateSubtasks: (id: number, subtasks: SubTask[]) => Promise<void>
  submitRecallGrade: (task: TaskItem, q: number) => Promise<void>
  searchQuery?: string
}

export function TaskList({
  activeTasksList,
  reviewQueueList,
  completedTasksList,
  categoriesMap,
  activeTaskId,
  setActiveTaskId,
  onActivateTask,
  toggleTask,
  updateSubtasks,
  submitRecallGrade,
  searchQuery = '',
}: TaskListProps) {
  const { t } = useTranslation()
  const [completedVisibleCount, setCompletedVisibleCount] = useState(COMPLETED_DISPLAY_CAP)
  const [completedOpen, setCompletedOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(COMPLETED_SECTION_KEY) === 'true'
  })

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const matchesSearch = (task: TaskItem) =>
    !normalizedQuery || task.text.toLowerCase().includes(normalizedQuery)

  const filteredActive = activeTasksList.filter(matchesSearch)
  const filteredCompleted = completedTasksList.filter(matchesSearch)
  const visibleCompleted = filteredCompleted.slice(0, completedVisibleCount)

  const toggleCompletedSection = () => {
    setCompletedOpen(prev => {
      const next = !prev
      localStorage.setItem(COMPLETED_SECTION_KEY, String(next))
      return next
    })
  }

  const handleAddSubtask = async (task: TaskItem, text: string) => {
    if (task.id === undefined) return
    const sub = { id: Date.now().toString(), text, completed: false }
    await updateSubtasks(task.id, [...(task.subtasks ?? []), sub])
  }

  const handleToggleSubtask = async (task: TaskItem, subId: string) => {
    if (task.id === undefined) return
    const subtasks = (task.subtasks ?? []).map(s =>
      s.id === subId ? { ...s, completed: !s.completed } : s,
    )
    await updateSubtasks(task.id, subtasks)
  }

  const handleDeleteSubtask = async (task: TaskItem, subId: string) => {
    if (task.id === undefined) return
    const subtasks = (task.subtasks ?? []).filter(s => s.id !== subId)
    await updateSubtasks(task.id, subtasks)
  }

  const subtaskHandlers = {
    onAddSubtask: handleAddSubtask,
    onToggleSubtask: handleToggleSubtask,
    onDeleteSubtask: handleDeleteSubtask,
  }

  return (
    <>
      <ReviewQueueSection
        reviewQueueList={reviewQueueList}
        categoriesMap={categoriesMap}
        submitRecallGrade={submitRecallGrade}
      />

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col pr-1">
        {filteredActive.length === 0 && filteredCompleted.length === 0 ? (
          <EmptyState
            borderless
            icon={<AlertCircle className="h-8 w-8" />}
            title={normalizedQuery ? t('taskNoMatchingTargets') : t('taskNoTargetsYet')}
            description={normalizedQuery
              ? t('taskTryDifferentSearch')
              : t('taskAddTargetBelow')}
            action={!normalizedQuery ? (
              <>
                <span className="hidden xl:inline-flex items-center gap-1.5 text-label text-muted">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  {t('taskUseFormAbove')}
                </span>
                <span className="inline-flex xl:hidden items-center gap-1.5 text-label text-muted">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  {t('taskUseBottomBar')}
                </span>
              </>
            ) : undefined}
          />
        ) : (
          <ActiveTasksList
            tasks={filteredActive}
            categoriesMap={categoriesMap}
            activeTaskId={activeTaskId}
            setActiveTaskId={setActiveTaskId}
            onActivateTask={onActivateTask}
            toggleTask={toggleTask}
            {...subtaskHandlers}
          />
        )}

        <CompletedTasksSection
          filteredCompleted={filteredCompleted}
          visibleCompleted={visibleCompleted}
          completedOpen={completedOpen}
          completedVisibleCount={completedVisibleCount}
          onToggle={toggleCompletedSection}
          onShowMore={() => setCompletedVisibleCount(c => c + COMPLETED_DISPLAY_CAP)}
          categoriesMap={categoriesMap}
          setActiveTaskId={setActiveTaskId}
          onActivateTask={onActivateTask}
          toggleTask={toggleTask}
          {...subtaskHandlers}
        />
      </div>
    </>
  )
}
