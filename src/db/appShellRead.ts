import { studyDb } from './studyDb'
import type { StudySubject } from './types'

/**
 * App-shell live-query payload excluding Goal, Study Note, Calendar event, Flashcard, Task,
 * StudySession, and UI settings rows.
 * Goals: `GoalsView` via `listGoals`. Notes: App via `listNotes`. Events: App via `listCalendarEvents`.
 * Flashcards: App via `listFlashcards`. Tasks: App via `listTasks`. Sessions: App via `listStudySessions`.
 * UI settings (`dailyGoalMinutes`, `quickNotes`): App via `getUiSettings`.
 * Full snapshots for backup/export continue to use `getStudyData`.
 */
export type AppShellData = {
  subjects: StudySubject[]
}

export const EMPTY_APP_SHELL_DATA: AppShellData = {
  subjects: [],
}

/** Subjects-only shell read. Extracted entity and UI-settings tables use dedicated App live queries. */
export async function getAppShellData(): Promise<AppShellData> {
  const subjects = await studyDb.subjects.orderBy('createdAt').toArray()
  return { subjects }
}
