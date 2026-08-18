import type { ActiveFocusSession, StudySession } from '../db/types'

export type FirstStudyChecklistState = {
  hasSubject: boolean
  hasTask: boolean
  hasStartedFocus: boolean
}

export type FirstStudyStepDefinition = {
  title: string
  body: string
  actionLabel: string
  complete: boolean
}

export function hasStartedFocusSession(
  activeSession: ActiveFocusSession | null,
  staleFocusSession: ActiveFocusSession | null,
  studySessions: StudySession[],
): boolean {
  if (activeSession || staleFocusSession) return true
  return studySessions.some((session) => session.id.startsWith('focus-'))
}

export function buildFirstStudyChecklistSteps(state: FirstStudyChecklistState): FirstStudyStepDefinition[] {
  return [
    {
      title: 'Create a subject',
      body: 'Subjects keep your study work organized.',
      actionLabel: 'Create subject',
      complete: state.hasSubject,
    },
    {
      title: 'Add your first task',
      body: 'Tasks turn your next study step into a clear plan.',
      actionLabel: 'Add task',
      complete: state.hasTask,
    },
    {
      title: 'Start a focus session',
      body: 'Focus helps you begin a dedicated study block.',
      actionLabel: 'Go to focus',
      complete: state.hasStartedFocus,
    },
  ]
}
