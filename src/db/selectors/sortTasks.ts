import type { TaskItem } from '../types'

export function mapLegacyTaskFields(tasks: TaskItem[]): TaskItem[] {
  return tasks
    .filter(task => !task.archived)
    .map(task => ({
      ...task,
      estimatedCycles: task.estimatedCycles ?? (task as TaskItem & { estimatedPomodoros?: number }).estimatedPomodoros ?? 1,
      actualCycles: task.actualCycles ?? (task as TaskItem & { actualPomodoros?: number }).actualPomodoros ?? 0,
    }))
}

function getPriorityWeight(priority?: 'low' | 'medium' | 'high') {
  if (priority === 'high') return 0
  if (priority === 'low') return 2
  return 1
}

export function sortTasks(tasks: TaskItem[]): TaskItem[] {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1
    }
    const weightA = getPriorityWeight(a.priority)
    const weightB = getPriorityWeight(b.priority)
    if (weightA !== weightB) {
      return weightA - weightB
    }
    return (b.createdAt || 0) - (a.createdAt || 0)
  })
}
