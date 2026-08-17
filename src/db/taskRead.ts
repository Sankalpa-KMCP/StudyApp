import { studyDb } from './studyDb'
import type { StudyTask } from './types'

/** Ordered Task rows for the App-owned Tasks live query (same order as former shell/`getStudyData`). */
export async function listTasks(): Promise<StudyTask[]> {
  return studyDb.tasks.orderBy('createdAt').toArray()
}
