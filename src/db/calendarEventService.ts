import { createId, nowIso, studyDb } from './studyDb'
import { assertSubjectExists } from './subjectValidation'
import type { CalendarEvent } from './types'

/** Fields the Calendar editor supplies after title and date/time validation. */
export type CalendarEventWriteFields = {
  title: string
  subjectId: string
  startAt: string
  endAt: string
  location: string
}

/**
 * Persist a new calendar event. Owns id and created/updated timestamps.
 * Enforces transactional subject referential integrity.
 */
export async function createCalendarEvent(fields: CalendarEventWriteFields): Promise<CalendarEvent> {
  return studyDb.transaction('rw', studyDb.subjects, studyDb.events, async () => {
    await assertSubjectExists(fields.subjectId)
    const timestamp = nowIso()
    const event: CalendarEvent = {
      id: createId('event'),
      title: fields.title,
      subjectId: fields.subjectId,
      startAt: fields.startAt,
      endAt: fields.endAt,
      location: fields.location,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    await studyDb.events.add(event)
    return event
  })
}

/**
 * Update an existing calendar event's editable fields and refresh `updatedAt`.
 * Enforces transactional subject referential integrity.
 * Throws when no row matches `id`.
 */
export async function updateCalendarEvent(id: string, fields: CalendarEventWriteFields): Promise<void> {
  return studyDb.transaction('rw', studyDb.subjects, studyDb.events, async () => {
    await assertSubjectExists(fields.subjectId)
    const updated = await studyDb.events.update(id, {
      title: fields.title,
      subjectId: fields.subjectId,
      startAt: fields.startAt,
      endAt: fields.endAt,
      location: fields.location,
      updatedAt: nowIso(),
    })
    if (updated === 0) throw new Error('Event no longer exists.')
  })
}

/**
 * Delete a calendar event by id. Missing rows are not treated as errors (Dexie delete is idempotent).
 */
export async function deleteCalendarEvent(id: string): Promise<void> {
  await studyDb.events.delete(id)
}
