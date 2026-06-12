import { useEffect } from 'react'
import { ARCHIVED_TASKS } from '../lib/uxTerms'
import { db } from '../db/db'
import type { TaskItem } from '../db/types'

interface UseTaskActionsOptions {
  sessionTasks: TaskItem[]
  addTask: (
    text: string,
    categoryId?: number,
    estimatedCycles?: number,
    priority?: 'low' | 'medium' | 'high',
    isStudySubject?: boolean,
  ) => Promise<number>
  toggleTask: (id: number) => Promise<void>
  playChime: () => void
  activeTaskId: number | null
  setActiveTaskId: (id: number | null) => void
  activateTask: (task: TaskItem) => void
  sessionCategoryId: number | undefined
  taskCycleCount: number
  autoArchiveAncientTasks: boolean
  isDataReady: boolean
  pushToast: (key: string, message: string, options?: { action?: { label: string; onClick: () => void }; durationMs?: number }) => void
}

export function useTaskActions({
  sessionTasks,
  addTask,
  toggleTask,
  playChime,
  activeTaskId,
  setActiveTaskId,
  activateTask,
  sessionCategoryId,
  taskCycleCount,
  autoArchiveAncientTasks,
  isDataReady,
  pushToast,
}: UseTaskActionsOptions) {
  useEffect(() => {
    if (isDataReady && autoArchiveAncientTasks) {
      const archiveAncientTasks = async () => {
        const ninetyDaysAgo = Date.now() - 7776000000
        const allTasks = await db.tasks.toArray()
        const targetTasks = allTasks.filter(t => t.completed && t.createdAt < ninetyDaysAgo && !t.archived)
        if (targetTasks.length > 0) {
          const ids = targetTasks.map(t => t.id).filter((id): id is number => id !== undefined)
          if (ids.length > 0) {
            await Promise.all(ids.map(id => db.tasks.update(id, { archived: true })))
            pushToast('ARCHIVE', ARCHIVED_TASKS(ids.length))
          }
        }
      }
      void archiveAncientTasks()
    }
  }, [isDataReady, autoArchiveAncientTasks, pushToast])

  async function handleAddTask(
    text: string,
    categoryId?: number,
    estimatedCycles?: number,
    priority?: 'low' | 'medium' | 'high',
    isStudySubject?: boolean,
  ) {
    const trimmed = text.trim()
    if (!trimmed) return
    const resolvedCategoryId = categoryId ?? sessionCategoryId
    const cycles = estimatedCycles ?? taskCycleCount
    const taskId = await addTask(trimmed, resolvedCategoryId, cycles, priority, isStudySubject)
    activateTask({
      id: taskId,
      text: trimmed,
      completed: false,
      createdAt: Date.now(),
      categoryId: resolvedCategoryId,
      estimatedCycles: cycles,
      actualCycles: 0,
      priority,
      isStudySubject,
    })
  }

  async function handleToggleTask(id: number) {
    const task = sessionTasks.find(t => t.id === id)
    if (task) {
      if (!task.completed) {
        playChime()
        window.dispatchEvent(new CustomEvent('celebrate-complete', { detail: { count: 50 } }))
        await toggleTask(id)
        pushToast('UNDO', 'Task completed', {
          durationMs: 5000,
          action: {
            label: 'Undo',
            onClick: () => { void db.tasks.update(id, { completed: false, nextReviewDate: undefined }) },
          },
        })
      } else {
        await db.tasks.update(id, { completed: false, nextReviewDate: undefined })
      }
    }
    if (activeTaskId === id) setActiveTaskId(null)
  }

  return { handleAddTask, handleToggleTask }
}
