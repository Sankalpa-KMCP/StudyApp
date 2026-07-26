import { studyDb } from './studyDb'
import type {
  CalendarEvent,
  Flashcard,
  StudySession,
  StudySetting,
  StudySubject,
  StudyTask,
} from './types'

/**
 * App-shell live-query payload excluding Goal rows and Study Note rows.
 * Goals: `GoalsView` via `listGoals`. Notes: App via `listNotes`.
 * Full snapshots for backup/export continue to use `getStudyData`.
 */
export type AppShellData = {
  tasks: StudyTask[]
  subjects: StudySubject[]
  events: CalendarEvent[]
  flashcards: Flashcard[]
  studySessions: StudySession[]
  settings: StudySetting[]
}

export const EMPTY_APP_SHELL_DATA: AppShellData = {
  tasks: [],
  subjects: [],
  events: [],
  flashcards: [],
  studySessions: [],
  settings: [],
}

/** Parallel shell reads matching `getStudyData` ordering, excluding `goals` and `notes`. */
export async function getAppShellData(): Promise<AppShellData> {
  const [tasks, subjects, events, flashcards, studySessions, settings] = await Promise.all([
    studyDb.tasks.orderBy('createdAt').toArray(),
    studyDb.subjects.orderBy('createdAt').toArray(),
    studyDb.events.orderBy('startAt').toArray(),
    studyDb.flashcards.orderBy('createdAt').toArray(),
    studyDb.studySessions.orderBy('startedAt').reverse().toArray(),
    studyDb.settings.toArray(),
  ])

  return { tasks, subjects, events, flashcards, studySessions, settings }
}
