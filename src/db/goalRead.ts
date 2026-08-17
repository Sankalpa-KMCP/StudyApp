import { studyDb } from './studyDb'
import type { StudyGoal } from './types'

/** Ordered Goal rows for the Goals workspace live query (same order as `getStudyData`). */
export async function listGoals(): Promise<StudyGoal[]> {
  return studyDb.goals.orderBy('createdAt').toArray()
}
