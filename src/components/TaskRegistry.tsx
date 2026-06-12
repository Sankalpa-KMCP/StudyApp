import React, { useState } from 'react'
import { Search } from 'lucide-react'
import type { TaskItem, CategoryItem } from '../db/types'
import { TaskCreateForm } from './task-registry/TaskCreateForm'
import { TaskList } from './task-registry/TaskList'
import { useTaskFilters, useTodayDateString } from './task-registry/useTaskFilters'
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
  handleAddTask,
  submitRecallGrade,
  timerCategoryId,
  setTimerCategoryId,
  timerMode,
  taskCycleCount,
  setTaskCycleCount,
}) => {
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
    <div className="flex flex-col gap-6 h-full w-full min-h-0">
      <PanelCard className="flex flex-col h-full min-h-0 glass-quiet">
        <PanelHeader title="Focus targets" bordered={false} className="mb-4" />

        <div className="hidden lg:block">
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
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" aria-hidden />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search targets…"
              aria-label="Search focus targets"
              className="w-full rounded-full border border-white/8 bg-white/[0.03] pl-9 pr-4 py-2 text-xs text-text-primary placeholder:text-muted outline-none focus:border-accent-blue/40"
            />
          </div>
        )}

        <TaskList
          activeTasksList={activeTasksList}
          reviewQueueList={reviewQueueList}
          completedTasksList={completedTasksList}
          categoriesMap={categoriesMap}
          activeTaskId={activeTaskId}
          setActiveTaskId={setActiveTaskId}
          onActivateTask={activateTask}
          toggleTask={toggleTask}
          submitRecallGrade={submitRecallGrade}
          searchQuery={searchQuery}
        />
      </PanelCard>

      <div className="lg:hidden fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] left-4 right-4 z-20 flex gap-2 p-2 rounded-2xl glass-panel border border-white/10 shadow-2xl">
        <input
          id="task-input-mobile"
          type="text"
          value={taskText}
          onChange={e => setTaskText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitNewTask() }}
          placeholder="Add focus target…"
          aria-label="Add focus target"
          className="flex-1 min-w-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-accent-blue/40"
        />
        <button
          type="button"
          onClick={submitNewTask}
          disabled={!taskText.trim()}
          className="shrink-0 rounded-xl bg-accent-blue px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40 transition-all ios-active-scale"
        >
          Add
        </button>
      </div>
    </div>
  )
}
