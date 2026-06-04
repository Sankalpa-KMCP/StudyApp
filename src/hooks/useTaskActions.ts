import { useEffect } from 'react'
import { db } from '../db/db'
import type { TaskItem } from '../db/types'

interface UseTaskActionsOptions {
  sessionTasks: TaskItem[]
  addTask: (text: string, categoryId?: number, estimatedCycles?: number, priority?: 'low' | 'medium' | 'high', isStudySubject?: boolean) => void
  toggleTask: (id: number) => Promise<void>
  playChime: () => void
  activeTaskId: number | null
  setActiveTaskId: (id: number | null) => void
  taskCycleCount: number
  autoArchiveAncientTasks: boolean
  isDataReady: boolean
  pushToast: (key: string, message: string) => void
}

export function useTaskActions({
  sessionTasks,
  addTask,
  toggleTask,
  playChime,
  activeTaskId,
  setActiveTaskId,
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
            pushToast('ARCHIVE', `AUTO-ARCHIVED ${ids.length} COMPLETED TASKS (90+ DAYS)`)
          }
        }
      }
      void archiveAncientTasks()
    }
  }, [isDataReady, autoArchiveAncientTasks, pushToast])

  function handleAddTask(
    text: string,
    categoryId?: number,
    estimatedCycles?: number,
    priority?: 'low' | 'medium' | 'high',
    isStudySubject?: boolean,
  ) {
    const trimmed = text.trim()
    if (!trimmed) return
    addTask(trimmed, categoryId, estimatedCycles ?? taskCycleCount, priority, isStudySubject)
  }

  async function handleToggleTask(id: number) {
    const task = sessionTasks.find(t => t.id === id)
    if (task) {
      if (!task.completed) {
        playChime()
        await toggleTask(id)
      } else {
        await db.tasks.update(id, { completed: false, nextReviewDate: undefined })
      }
    }
    if (activeTaskId === id) setActiveTaskId(null)
  }

  return { handleAddTask, handleToggleTask }
}
