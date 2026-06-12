import { useEffect } from 'react'
import { ARCHIVED_TASKS } from '../lib/shared/uxTerms'
import { spawnNextRecurrence } from '../lib/study/recurrence'
import { archiveTasks, getAllTasks, uncompleteTask, updateLastCompleted } from '../db/repositories/tasks'
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
  autoArchiveAfterDays: number
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
  autoArchiveAfterDays,
  isDataReady,
  pushToast,
}: UseTaskActionsOptions) {
  useEffect(() => {
    if (isDataReady && autoArchiveAncientTasks) {
      const archiveAncientTasks = async () => {
        const cutoff = Date.now() - autoArchiveAfterDays * 86400000
        const allTasks = await getAllTasks()
        const targetTasks = allTasks.filter(t => t.completed && t.createdAt < cutoff && !t.archived)
        if (targetTasks.length > 0) {
          const ids = targetTasks.map(t => t.id).filter((id): id is number => id !== undefined)
          if (ids.length > 0) {
            await archiveTasks(ids)
            pushToast('ARCHIVE', ARCHIVED_TASKS(ids.length))
          }
        }
      }
      void archiveAncientTasks()
    }
  }, [isDataReady, autoArchiveAncientTasks, autoArchiveAfterDays, pushToast])

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
        await updateLastCompleted(id)
        if (task.recurrenceRule) {
          void spawnNextRecurrence({ ...task, completed: true, lastCompletedAt: Date.now() })
        }
        pushToast('UNDO', 'Task completed', {
          durationMs: 5000,
          action: {
            label: 'Undo',
            onClick: () => { void uncompleteTask(id) },
          },
        })
      } else {
        await uncompleteTask(id)
      }
    }
    if (activeTaskId === id) setActiveTaskId(null)
  }

  return { handleAddTask, handleToggleTask }
}
