import { studyDb } from './studyDb'
import type {
  CalendarEvent,
  Flashcard,
  StudyNote,
  StudySession,
  StudySetting,
  StudySubject,
  StudyTask,
} from './types'

/**
 * App-shell live-query payload: all current UI tables except Goal rows.
 * Goal rows are owned by `GoalsView` via `listGoals`.
 * Full snapshots for backup/export continue to use `getStudyData`.
 */
export type AppShellData = {
  tasks: StudyTask[]
  subjects: StudySubject[]
  notes: StudyNote[]
  events: CalendarEvent[]
  flashcards: Flashcard[]
  studySessions: StudySession[]
  settings: StudySetting[]
}

export const EMPTY_APP_SHELL_DATA: AppShellData = {
  tasks: [],
  subjects: [],
  notes: [],
  events: [],
  flashcards: [],
  studySessions: [],
  settings: [],
}

/** Parallel shell reads matching `getStudyData` ordering, excluding `goals`. */
export async function getAppShellData(): Promise<AppShellData> {
  const [tasks, subjects, notes, events, flashcards, studySessions, settings] = await Promise.all([
    studyDb.tasks.orderBy('createdAt').toArray(),
    studyDb.subjects.orderBy('createdAt').toArray(),
    studyDb.notes.orderBy('updatedAt').reverse().toArray(),
    studyDb.events.orderBy('startAt').toArray(),
    studyDb.flashcards.orderBy('createdAt').toArray(),
    studyDb.studySessions.orderBy('startedAt').reverse().toArray(),
    studyDb.settings.toArray(),
  ])

  return { tasks, subjects, notes, events, flashcards, studySessions, settings }
}
