import type {
  ActiveFocusSession,
  CalendarEvent,
  StudySubject,
  StudyTask,
} from '../db/types'
import type { View } from '../navigation/viewRoutes'
import {
  getOpenOverdueTasks,
  getOpenTasksDueToday,
  getTodaysEvents,
} from './dashboardDateHelpers'

/** Deterministic next-step kinds for the Home dashboard (presentation owns user-facing copy). */
export type RecommendedActionKind =
  | 'overdue_task'
  | 'due_today_task'
  | 'today_event'
  | 'continue_focus'
  | 'start_focus'
  | 'create_subject'
  | 'neutral'

export type RecommendedActionIntent = 'navigate' | 'focus_card' | 'create_subject'

export type RecommendedNextAction = {
  kind: RecommendedActionKind
  intent: RecommendedActionIntent
  /** Workspace to open for navigate intents; omitted for in-page focus / create-subject. */
  view?: View
  recordId?: string
  /** Neutral record title / front text for the view to incorporate into copy. */
  title?: string
}

export type RecommendedNextActionInput = {
  tasks: readonly StudyTask[]
  events: readonly CalendarEvent[]
  subjects: readonly StudySubject[]
  activeSession: ActiveFocusSession | null
  /** Finalized minutes credited today (excludes unfinished focus). */
  todayFocusMinutes: number
  dailyGoalMinutes: number
  now?: Date
}

/**
 * Picks one recommended next action using the approved Home priority.
 * Does not mutate inputs. User-facing prose stays in the Home presentation layer.
 */
export function getRecommendedNextAction(input: RecommendedNextActionInput): RecommendedNextAction {
  const now = input.now ?? new Date()

  const overdue = getOpenOverdueTasks(input.tasks, now)
  if (overdue.length > 0) {
    const task = overdue[0]
    return {
      kind: 'overdue_task',
      intent: 'navigate',
      view: 'Tasks',
      recordId: task.id,
      title: task.title,
    }
  }

  const dueToday = getOpenTasksDueToday(input.tasks, now)
  if (dueToday.length > 0) {
    const task = dueToday[0]
    return {
      kind: 'due_today_task',
      intent: 'navigate',
      view: 'Tasks',
      recordId: task.id,
      title: task.title,
    }
  }

  const todaysEvents = getTodaysEvents(input.events, now)
  if (todaysEvents.length > 0) {
    const event = todaysEvents[0]
    return {
      kind: 'today_event',
      intent: 'navigate',
      view: 'Calendar',
      recordId: event.id,
      title: event.title,
    }
  }

  if (input.activeSession) {
    return {
      kind: 'continue_focus',
      intent: 'focus_card',
      recordId: input.activeSession.id,
    }
  }

  if (input.subjects.length === 0) {
    return {
      kind: 'create_subject',
      intent: 'create_subject',
    }
  }

  if (input.todayFocusMinutes < input.dailyGoalMinutes) {
    return {
      kind: 'start_focus',
      intent: 'focus_card',
    }
  }

  return {
    kind: 'neutral',
    intent: 'navigate',
    view: 'Progress',
  }
}
