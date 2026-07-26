import { studyDb } from './studyDb'
import type { StudySubject } from './types'

/** Ordered Subject rows for the App-owned Subjects live query (same order as former shell/`getStudyData`). */
export async function listSubjects(): Promise<StudySubject[]> {
  return studyDb.subjects.orderBy('createdAt').toArray()
}
