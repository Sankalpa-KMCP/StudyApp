import { localDateKey, parseLocalDateTime } from '../appUtils'
import type { CalendarEvent, StudyTask } from '../db/types'

/**
 * True when `value` is a real local calendar date-only key (`YYYY-MM-DD`).
 * Uses local field construction — never `new Date('YYYY-MM-DD')` UTC parsing.
 */
export function isLocalDateOnlyKey(value: string): boolean {
  return parseLocalDateTime(value, '00:00') !== null
}

/**
 * Open tasks whose `dueDate` equals the current local calendar day.
 * Preserves the relative order of the input list (typically `createdAt` ascending from `listTasks`).
 */
export function getOpenTasksDueToday(tasks: readonly StudyTask[], now = new Date()): StudyTask[] {
  const todayKey = localDateKey(now)
  return tasks.filter(
    (task) => task.status === 'open' && isLocalDateOnlyKey(task.dueDate) && task.dueDate === todayKey,
  )
}

/**
 * Open tasks with a valid due date strictly before the current local calendar day.
 * Preserves the relative order of the input list.
 */
export function getOpenOverdueTasks(tasks: readonly StudyTask[], now = new Date()): StudyTask[] {
  const todayKey = localDateKey(now)
  return tasks.filter(
    (task) => task.status === 'open' && isLocalDateOnlyKey(task.dueDate) && task.dueDate < todayKey,
  )
}

/**
 * Calendar events whose `startAt` falls on the current local calendar day,
 * ordered by `startAt` ascending. Does not mutate the input array.
 */
export function getTodaysEvents(events: readonly CalendarEvent[], now = new Date()): CalendarEvent[] {
  const todayKey = localDateKey(now)
  return events
    .filter((event) => localDateKey(event.startAt) === todayKey)
    .slice()
    .sort((left, right) => dateTimestamp(left.startAt) - dateTimestamp(right.startAt))
}

function dateTimestamp(value: string) {
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
}
