import { runBackupableMutation } from './backupabilityGuard'
import {
  type DatabaseMutationContext,
  withGuardedMutation,
} from './databaseMutationGuard'
import { createId, nowIso, studyDb } from './studyDb'
import { assertSubjectExists } from './subjectValidation'
import type { CalendarEvent } from './types'
import { assertCalendarEventWriteFields } from './validation/domainValidation'

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
 * Enforces transactional subject referential integrity, canonical backupability guard, and database generation guard.
 */
export async function createCalendarEvent(
  fields: CalendarEventWriteFields,
  context: DatabaseMutationContext,
): Promise<CalendarEvent> {
  return withGuardedMutation(context, () => {
    assertCalendarEventWriteFields(fields)
    return runBackupableMutation(async () => {
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
  })
}

/**
 * Update an existing calendar event's editable fields and refresh `updatedAt`.
 * Enforces transactional subject referential integrity, canonical backupability guard, and database generation guard.
 * Throws when no row matches `id`.
 */
export async function updateCalendarEvent(
  id: string,
  fields: CalendarEventWriteFields,
  context: DatabaseMutationContext,
): Promise<void> {
  return withGuardedMutation(context, () => {
    assertCalendarEventWriteFields(fields)
    return runBackupableMutation(async () => {
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
  })
}

/**
 * Delete a calendar event by id under database generation guard.
 * Missing rows are not treated as errors (Dexie delete is idempotent).
 */
export async function deleteCalendarEvent(
  id: string,
  context: DatabaseMutationContext,
): Promise<void> {
  return withGuardedMutation(context, async () => {
    await studyDb.events.delete(id)
  })
}
