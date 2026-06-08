import React, { useMemo, useState } from 'react'
import { Target } from 'lucide-react'
import type { TaskItem, CategoryItem } from '../db/types'
import { TaskCreateForm } from './task-registry/TaskCreateForm'
import { TaskList } from './task-registry/TaskList'
import { useTaskFilters, useTodayDateString } from './task-registry/useTaskFilters'
import { InlineCategoryManager } from './shared/InlineCategoryManager'

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

  const todayStr = useTodayDateString()
  const { categoriesMap, activeTasksList, reviewQueueList } = useTaskFilters(tasks, categories, todayStr)

  const submitNewTask = () => {
    const trimmed = taskText.trim()
    if (!trimmed) return
    void handleAddTask(trimmed, timerCategoryId, taskCycleCount, taskPriority, taskIsStudySubject)
    setTaskText('')
    setTaskIsStudySubject(false)
  }

  const activeTask = useMemo(() => {
    if (activeTaskId === null) return null
    return tasks.find(t => t.id === activeTaskId && !t.completed) || null
  }, [activeTaskId, tasks])

  return (
    <div className="flex flex-col gap-6 h-full w-full">
      <div className="border border-white/5 bg-white/[0.02] rounded-[28px] p-5 md:p-6 flex flex-col h-full shadow-2xl backdrop-blur-3xl">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5 border-b border-white/5 pb-4">
          <div className="select-none shrink-0">
            <span className="text-label font-bold uppercase tracking-wider text-white/40">Study tasks</span>
            <p className="text-sm font-bold text-white mt-1">Focus targets</p>
          </div>

          {timerMode === 'study' && (
            <div className="min-w-[180px] flex-1 sm:max-w-xs">
              <InlineCategoryManager
                label="Subject"
                categories={categories}
                addCategory={addCategory}
                deleteCategory={deleteCategory}
                selectedCategoryId={timerCategoryId}
                onSelectCategory={setTimerCategoryId}
              />
            </div>
          )}
        </div>

        {activeTask && (
          <div className="mb-5 flex items-center gap-3.5 rounded-[20px] border border-white/5 bg-black/20 p-4 shadow-md animate-slide-in-up">
            <div className="h-2 w-2 rounded-full bg-accent-blue" />
            <div className="flex-1 min-w-0">
              <p className="text-label uppercase font-bold text-white/40">Active target</p>
              <p className="truncate text-xs font-bold text-white mt-0.5 whitespace-pre-wrap">{activeTask.text}</p>
            </div>
            <span className="whitespace-nowrap text-xs font-mono font-bold text-white/75 flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full border border-white/5">
              <Target className="h-3.5 w-3.5 text-white/40" />
              <span>{activeTask.actualCycles ?? 0}/{activeTask.estimatedCycles ?? 1}</span>
            </span>
          </div>
        )}

        <TaskCreateForm
          taskText={taskText}
          setTaskText={setTaskText}
          sessionCategoryId={timerCategoryId}
          categories={categories}
          taskPriority={taskPriority}
          setTaskPriority={setTaskPriority}
          taskCycleCount={taskCycleCount}
          setTaskCycleCount={setTaskCycleCount}
          taskIsStudySubject={taskIsStudySubject}
          setTaskIsStudySubject={setTaskIsStudySubject}
          onSubmit={submitNewTask}
        />

        <TaskList
          activeTasksList={activeTasksList}
          reviewQueueList={reviewQueueList}
          categoriesMap={categoriesMap}
          activeTaskId={activeTaskId}
          setActiveTaskId={setActiveTaskId}
          onActivateTask={activateTask}
          toggleTask={toggleTask}
          submitRecallGrade={submitRecallGrade}
        />
      </div>
    </div>
  )
}
