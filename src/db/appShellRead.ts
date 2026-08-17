import { studyDb } from './studyDb'
import type {
  StudySession,
  StudySetting,
  StudySubject,
  StudyTask,
} from './types'

/**
 * App-shell live-query payload excluding Goal, Study Note, Calendar event, and Flashcard rows.
 * Goals: `GoalsView` via `listGoals`. Notes: App via `listNotes`. Events: App via `listCalendarEvents`.
 * Flashcards: App via `listFlashcards`. Full snapshots for backup/export continue to use `getStudyData`.
 */
export type AppShellData = {
  tasks: StudyTask[]
  subjects: StudySubject[]
  studySessions: StudySession[]
  settings: StudySetting[]
}

export const EMPTY_APP_SHELL_DATA: AppShellData = {
  tasks: [],
  subjects: [],
  studySessions: [],
  settings: [],
}

/** Parallel shell reads matching `getStudyData` ordering, excluding `goals`, `notes`, `events`, and `flashcards`. */
export async function getAppShellData(): Promise<AppShellData> {
  const [tasks, subjects, studySessions, settings] = await Promise.all([
    studyDb.tasks.orderBy('createdAt').toArray(),
    studyDb.subjects.orderBy('createdAt').toArray(),
    studyDb.studySessions.orderBy('startedAt').reverse().toArray(),
    studyDb.settings.toArray(),
  ])

  return { tasks, subjects, studySessions, settings }
}
