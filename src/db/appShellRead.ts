import { studyDb } from './studyDb'
import type {
  Flashcard,
  StudySession,
  StudySetting,
  StudySubject,
  StudyTask,
} from './types'

/**
 * App-shell live-query payload excluding Goal rows, Study Note rows, and Calendar event rows.
 * Goals: `GoalsView` via `listGoals`. Notes: App via `listNotes`. Events: App via `listCalendarEvents`.
 * Full snapshots for backup/export continue to use `getStudyData`.
 */
export type AppShellData = {
  tasks: StudyTask[]
  subjects: StudySubject[]
  flashcards: Flashcard[]
  studySessions: StudySession[]
  settings: StudySetting[]
}

export const EMPTY_APP_SHELL_DATA: AppShellData = {
  tasks: [],
  subjects: [],
  flashcards: [],
  studySessions: [],
  settings: [],
}

/** Parallel shell reads matching `getStudyData` ordering, excluding `goals`, `notes`, and `events`. */
export async function getAppShellData(): Promise<AppShellData> {
  const [tasks, subjects, flashcards, studySessions, settings] = await Promise.all([
    studyDb.tasks.orderBy('createdAt').toArray(),
    studyDb.subjects.orderBy('createdAt').toArray(),
    studyDb.flashcards.orderBy('createdAt').toArray(),
    studyDb.studySessions.orderBy('startedAt').reverse().toArray(),
    studyDb.settings.toArray(),
  ])

  return { tasks, subjects, flashcards, studySessions, settings }
}
