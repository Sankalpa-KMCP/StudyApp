import { studyDb } from './studyDb'
import type { StudyNote } from './types'

/** Ordered Study Note rows for the App-owned Notes live query (same order as former shell/`getStudyData`). */
export async function listNotes(): Promise<StudyNote[]> {
  return studyDb.notes.orderBy('updatedAt').reverse().toArray()
}
