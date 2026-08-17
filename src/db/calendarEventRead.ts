import { studyDb } from './studyDb'
import type { CalendarEvent } from './types'

/** Ordered Calendar event rows for the App-owned Events live query (same order as former shell/`getStudyData`). */
export async function listCalendarEvents(): Promise<CalendarEvent[]> {
  return studyDb.events.orderBy('startAt').toArray()
}
