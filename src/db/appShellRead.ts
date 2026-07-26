import { studyDb } from './studyDb'
import type {
  StudySession,
  StudySetting,
  StudySubject,
} from './types'

/**
 * App-shell live-query payload excluding Goal, Study Note, Calendar event, Flashcard, and Task rows.
 * Goals: `GoalsView` via `listGoals`. Notes: App via `listNotes`. Events: App via `listCalendarEvents`.
 * Flashcards: App via `listFlashcards`. Tasks: App via `listTasks`.
 * Full snapshots for backup/export continue to use `getStudyData`.
 */
export type AppShellData = {
  subjects: StudySubject[]
  studySessions: StudySession[]
  settings: StudySetting[]
}

export const EMPTY_APP_SHELL_DATA: AppShellData = {
  subjects: [],
  studySessions: [],
  settings: [],
}

/** Parallel shell reads matching `getStudyData` ordering, excluding extracted entity tables. */
export async function getAppShellData(): Promise<AppShellData> {
  const [subjects, studySessions, settings] = await Promise.all([
    studyDb.subjects.orderBy('createdAt').toArray(),
    studyDb.studySessions.orderBy('startedAt').reverse().toArray(),
    studyDb.settings.toArray(),
  ])

  return { subjects, studySessions, settings }
}
