import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { TaskItem } from '../types'
import * as taskRepo from '../repositories/tasks'
import { mapLegacyTaskFields, sortTasks } from '../selectors/sortTasks'

export function useTasks() {
  const tasks = useLiveQuery<TaskItem[]>(() => db.tasks.orderBy('id').reverse().toArray())

  const sortedTasks = sortTasks(mapLegacyTaskFields(tasks ?? []))

  return {
    tasks: sortedTasks,
    addTask: taskRepo.addTask,
    toggleTask: taskRepo.toggleTask,
    incrementTaskCycle: taskRepo.incrementTaskCycle,
    isLoading: tasks === undefined,
  }
}
