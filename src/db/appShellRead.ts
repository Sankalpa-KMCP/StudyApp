import { studyDb } from './studyDb'
import type {
  StudySetting,
  StudySubject,
} from './types'

/**
 * App-shell live-query payload excluding Goal, Study Note, Calendar event, Flashcard, Task, and StudySession rows.
 * Goals: `GoalsView` via `listGoals`. Notes: App via `listNotes`. Events: App via `listCalendarEvents`.
 * Flashcards: App via `listFlashcards`. Tasks: App via `listTasks`. Sessions: App via `listStudySessions`.
 * Full snapshots for backup/export continue to use `getStudyData`.
 */
export type AppShellData = {
  subjects: StudySubject[]
  settings: StudySetting[]
}

export const EMPTY_APP_SHELL_DATA: AppShellData = {
  subjects: [],
  settings: [],
}

/** Parallel shell reads matching `getStudyData` ordering, excluding extracted entity tables. */
export async function getAppShellData(): Promise<AppShellData> {
  const [subjects, settings] = await Promise.all([
    studyDb.subjects.orderBy('createdAt').toArray(),
    studyDb.settings.toArray(),
  ])

  return { subjects, settings }
}
