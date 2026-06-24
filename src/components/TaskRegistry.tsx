import React, { useState } from 'react'
import { Search } from 'lucide-react'
import type { TaskItem, CategoryItem, SubTask } from '../db/types'
import { TaskCreateForm } from './task-registry/TaskCreateForm'
import { TaskList } from './task-registry/TaskList'
import { useTaskFilters, useTodayDateString } from '../hooks/useTaskFilters'
import { useTranslation } from '../i18n/useTranslation'
import { PanelCard } from './shared/PanelCard'
import { PanelHeader } from './shared/PanelHeader'

interface TaskRegistryProps {
  tasks: TaskItem[]
  categories: CategoryItem[]
  addCategory: (name: string, color: string) => Promise<number> | number
  deleteCategory: (id: number) => Promise<void> | void
  activeTaskId: number | null
  setActiveTaskId: (id: number | null) => void
  activateTask: (task: TaskItem) => void
  toggleTask: (id: number) => Promise<void>
  updateSubtasks: (id: number, subtasks: SubTask[]) => Promise<void>
  handleAddTask: (
    text: string,
    categoryId?: number,
    estimatedCycles?: number,
    priority?: 'low' | 'medium' | 'high',
    isStudySubject?: boolean,
  ) => void | Promise<void>
  submitRecallGrade: (task: TaskItem, q: number) => Promise<void>
  timerCategoryId: number | undefined
  setTimerCategoryId: (id: number | undefined) => void
  timerMode: 'study' | 'break'
  taskCycleCount: number
  setTaskCycleCount: (n: number) => void
}

export const TaskRegistry: React.FC<TaskRegistryProps> = ({
  tasks,
  categories,
  addCategory,
  deleteCategory,
  activeTaskId,
  setActiveTaskId,
  activateTask,
  toggleTask,
  updateSubtasks,
  handleAddTask,
  submitRecallGrade,
  timerCategoryId,
  setTimerCategoryId,
  timerMode,
  taskCycleCount,
  setTaskCycleCount,
}) => {
  const { t } = useTranslation()
  const [taskText, setTaskText] = useState('')
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [taskIsStudySubject, setTaskIsStudySubject] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const todayStr = useTodayDateString()
  const { categoriesMap, activeTasksList, reviewQueueList, completedTasksList } = useTaskFilters(tasks, categories, todayStr)

  const submitNewTask = () => {
    const trimmed = taskText.trim()
    if (!trimmed) return
    void handleAddTask(trimmed, timerCategoryId, taskCycleCount, taskPriority, taskIsStudySubject)
    setTaskText('')
    setTaskIsStudySubject(false)
  }

  return (
    <div className="flex flex-col gap-6 h-fit w-full min-h-0">
      <PanelCard className="flex flex-col h-fit overflow-hidden glass-quiet">
        <PanelHeader title={t('focusTargets')} bordered={false} />

        <div className="hidden xl:block shrink-0">
        <TaskCreateForm
          taskText={taskText}
          setTaskText={setTaskText}
          sessionCategoryId={timerCategoryId}
          onSelectCategory={setTimerCategoryId}
          categories={categories}
          addCategory={addCategory}
          deleteCategory={deleteCategory}
          timerMode={timerMode}
          taskPriority={taskPriority}
          setTaskPriority={setTaskPriority}
          taskCycleCount={taskCycleCount}
          setTaskCycleCount={setTaskCycleCount}
          taskIsStudySubject={taskIsStudySubject}
          setTaskIsStudySubject={setTaskIsStudySubject}
          onSubmit={submitNewTask}
        />
        </div>

        {(activeTasksList.length > 0 || completedTasksList.length > 0) && (
          <div className="relative mb-4 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" aria-hidden />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('taskSearchTargetsPlaceholder')}
              aria-label={t('taskSearchTargetsAria')}
              className="w-full rounded-chrome-lg border border-card/30 surface-subtle pl-9 pr-4 py-2 text-xs text-primary placeholder:text-muted outline-none focus-ring"
            />
          </div>
        )}

        <div className="flex flex-col">
          <TaskList
          activeTasksList={activeTasksList}
          reviewQueueList={reviewQueueList}
          completedTasksList={completedTasksList}
          categoriesMap={categoriesMap}
          activeTaskId={activeTaskId}
          setActiveTaskId={setActiveTaskId}
          onActivateTask={activateTask}
          toggleTask={toggleTask}
          updateSubtasks={updateSubtasks}
          submitRecallGrade={submitRecallGrade}
          searchQuery={searchQuery}
        />
        </div>
      </PanelCard>

      <div className="xl:hidden fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] inset-x-4 z-20 flex gap-2 p-2 rounded-2xl glass-panel border border-card shadow-2xl">
        <input
          id="task-input-mobile"
          type="text"
          value={taskText}
          onChange={e => setTaskText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitNewTask() }}
          placeholder={t('taskAddFocusTarget')}
          aria-label={t('taskAddFocusTargetAria')}
          className="flex-1 min-w-0 rounded-chrome-lg border border-card/30 surface-subtle pl-4 pr-3 py-2.5 text-xs text-primary placeholder:text-muted outline-none focus-ring"
        />
        <button
          type="button"
          onClick={submitNewTask}
          disabled={!taskText.trim()}
          className="shrink-0 rounded-chrome-lg bg-accent-blue px-4 py-2.5 text-xs font-bold text-on-accent disabled:opacity-40 transition-all ios-active-scale focus-ring"
        >
          {t('taskAddButton')}
        </button>
      </div>
    </div>
  )
}
