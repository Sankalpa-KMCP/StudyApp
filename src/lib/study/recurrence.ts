import type { TaskItem } from '../../db/types'

export function getNextRecurrenceDate(rule: TaskItem['recurrenceRule'], from = new Date()): Date | null {
  if (!rule) return null
  const next = new Date(from)
  if (rule === 'daily') {
    next.setDate(next.getDate() + 1)
    return next
  }
  if (rule === 'weekly') {
    next.setDate(next.getDate() + 7)
    return next
  }
  if (rule === 'weekdays') {
    do {
      next.setDate(next.getDate() + 1)
    } while (next.getDay() === 0 || next.getDay() === 6)
    return next
  }
  return null
}
