import { studyDb } from './studyDb'
import type { StudySession } from './types'

/** Ordered study-session history for the App-owned live query (same order as former shell/`getStudyData`). */
export async function listStudySessions(): Promise<StudySession[]> {
  return studyDb.studySessions.orderBy('startedAt').reverse().toArray()
}
