import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { DailyLog } from '../types'

/** Lightweight daily log rows for streak/XP — omits notes and mood. */
export type StudyMinuteSummary = Pick<DailyLog, 'dateString' | 'studyMinutes' | 'breakMinutes'>

export function useStudyMinuteSummaries() {
  const summaries = useLiveQuery(async () => {
    const logs = await db.daily_logs.toArray()
    return logs.map(({ dateString, studyMinutes, breakMinutes }) => ({
      dateString,
      studyMinutes,
      breakMinutes,
    }))
  })
  return { summaries: summaries ?? [], isLoading: summaries === undefined }
}
