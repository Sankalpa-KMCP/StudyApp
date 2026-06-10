import React, { useState } from 'react'
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

  const todayStr = useTodayDateString()
  const { categoriesMap, activeTasksList, reviewQueueList } = useTaskFilters(tasks, categories, todayStr)

  const submitNewTask = () => {
    const trimmed = taskText.trim()
    if (!trimmed) return
    void handleAddTask(trimmed, timerCategoryId, taskCycleCount, taskPriority, taskIsStudySubject)
    setTaskText('')
    setTaskIsStudySubject(false)
  }

  return (
    <div className="flex flex-col gap-6 h-full w-full min-h-0">
      <PanelCard className="flex flex-col h-full min-h-0">
        <PanelHeader title="Focus targets" bordered={false} className="mb-4" />

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
      </PanelCard>
    </div>
  )
}
