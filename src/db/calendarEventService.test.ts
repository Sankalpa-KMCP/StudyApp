import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from './calendarEventService'
import { studyDb } from './studyDb'

describe('calendarEventService', () => {
  beforeEach(async () => {
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('creates an event with generated id and matching timestamps', async () => {
    const created = await createCalendarEvent({
      title: 'Study group',
      subjectId: 'subject-math',
      startAt: '2026-08-01T14:00:00.000Z',
      endAt: '2026-08-01T15:30:00.000Z',
      location: 'Library room 3',
    })

    expect(created.id).toMatch(/^event-/)
    expect(created).toMatchObject({
      title: 'Study group',
      subjectId: 'subject-math',
      startAt: '2026-08-01T14:00:00.000Z',
      endAt: '2026-08-01T15:30:00.000Z',
      location: 'Library room 3',
    })
    expect(created.createdAt).toBe(created.updatedAt)
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false)
    expect(await studyDb.events.get(created.id)).toEqual(created)
  })

  it('updates editable fields and refreshes updatedAt while preserving createdAt', async () => {
    const original = await createCalendarEvent({
      title: 'Original',
      subjectId: '',
      startAt: '2026-08-02T10:00:00.000Z',
      endAt: '2026-08-02T11:00:00.000Z',
      location: 'Hall A',
    })

    await updateCalendarEvent(original.id, {
      title: 'Renamed',
      subjectId: 'subject-chem',
      startAt: '2026-08-03T16:15:00.000Z',
      endAt: '2026-08-03T17:00:00.000Z',
      location: 'Hall B',
    })

    const stored = await studyDb.events.get(original.id)
    expect(stored).toMatchObject({
      id: original.id,
      title: 'Renamed',
      subjectId: 'subject-chem',
      startAt: '2026-08-03T16:15:00.000Z',
      endAt: '2026-08-03T17:00:00.000Z',
      location: 'Hall B',
      createdAt: original.createdAt,
    })
    expect(Date.parse(stored!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(original.createdAt))
  })

  it('throws when updating a missing event', async () => {
    await expect(updateCalendarEvent('event-missing', {
      title: 'Gone',
      subjectId: '',
      startAt: '2026-08-01T09:00:00.000Z',
      endAt: '2026-08-01T10:00:00.000Z',
      location: '',
    })).rejects.toThrow('Event no longer exists.')
  })

  it('deletes an existing event', async () => {
    const created = await createCalendarEvent({
      title: 'Temporary',
      subjectId: '',
      startAt: '2026-08-04T09:00:00.000Z',
      endAt: '2026-08-04T10:00:00.000Z',
      location: 'Lab',
    })

    await deleteCalendarEvent(created.id)
    expect(await studyDb.events.get(created.id)).toBeUndefined()
  })

  it('treats deleting a missing event as success', async () => {
    await expect(deleteCalendarEvent('event-already-gone')).resolves.toBeUndefined()
    expect(await studyDb.events.count()).toBe(0)
  })
})
