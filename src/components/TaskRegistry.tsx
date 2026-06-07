import React, { useMemo, useState } from 'react'
import { Target } from 'lucide-react'
import type { TaskItem, CategoryItem } from '../db/types'
import { TaskCreateForm } from './task-registry/TaskCreateForm'
import { TaskList } from './task-registry/TaskList'
import { useTaskFilters, useTodayDateString } from './task-registry/useTaskFilters'

interface TaskRegistryProps {
  tasks: TaskItem[]
  categories: CategoryItem[]
  activeTaskId: number | null
  setActiveTaskId: (id: number | null) => void
  toggleTask: (id: number) => Promise<void>
  handleAddTask: (text: string, categoryId?: number, estimatedCycles?: number, priority?: 'low' | 'medium' | 'high', isStudySubject?: boolean) => void
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
  activeTaskId,
  setActiveTaskId,
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
  const [taskCategory, setTaskCategory] = useState<string>('')
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [taskIsStudySubject, setTaskIsStudySubject] = useState(false)

  const todayStr = useTodayDateString()
  const { categoriesMap, activeTasksList, reviewQueueList } = useTaskFilters(tasks, categories, todayStr)

  const submitNewTask = () => {
    const trimmed = taskText.trim()
    if (!trimmed) return
    const catId = taskCategory ? Number(taskCategory) : undefined
    handleAddTask(trimmed, catId, taskCycleCount, taskPriority, taskIsStudySubject)
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-white/5 pb-4">
          <div className="select-none">
            <span className="text-label font-bold uppercase tracking-wider text-white/40">Study tasks</span>
            <p className="text-sm font-bold text-white mt-1">Focus targets</p>
          </div>

          {timerMode === 'study' && (
            <div className="flex items-center gap-2.5">
              <span className="text-label font-bold text-white/40 uppercase tracking-wide select-none">Subject:</span>
              <select
                value={timerCategoryId ?? ''}
                onChange={e => setTimerCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-white outline-none cursor-pointer hover:bg-white/10 transition-colors"
              >
                <option value="" className="bg-[#11131e] text-white/40">General / None</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id} className="bg-[#11131e] text-white">{cat.name}</option>
                ))}
              </select>
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
          taskCategory={taskCategory}
          setTaskCategory={setTaskCategory}
          taskPriority={taskPriority}
          setTaskPriority={setTaskPriority}
          taskCycleCount={taskCycleCount}
          setTaskCycleCount={setTaskCycleCount}
          taskIsStudySubject={taskIsStudySubject}
          setTaskIsStudySubject={setTaskIsStudySubject}
          categories={categories}
          onSubmit={submitNewTask}
        />

        <TaskList
          activeTasksList={activeTasksList}
          reviewQueueList={reviewQueueList}
          categoriesMap={categoriesMap}
          activeTaskId={activeTaskId}
          setActiveTaskId={setActiveTaskId}
          toggleTask={toggleTask}
          submitRecallGrade={submitRecallGrade}
        />
      </div>
    </div>
  )
}
