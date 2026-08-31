import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from './calendarEventService'
import { SubjectNotFoundError } from './subjectValidation'
import { DATABASE_GENERATION_KEY, StaleDatabaseGenerationError } from './databaseGeneration'
import { installInMemoryLockAdapter } from './crossTabLock'
import { studyDb } from './studyDb'

describe('calendarEventService', () => {
  beforeEach(async () => {
    installInMemoryLockAdapter()
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('creates an event with generated id and matching timestamps for existing subject', async () => {
    await studyDb.subjects.add({
      id: 'subject-math',
      name: 'Mathematics',
      color: '#3b82f6',
      targetHours: 10,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    const created = await createCalendarEvent({
      title: 'Study group',
      subjectId: 'subject-math',
      startAt: '2026-08-01T14:00:00.000Z',
      endAt: '2026-08-01T15:30:00.000Z',
      location: 'Library room 3',
    }, { expectedGeneration: 1 })

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

  it('creates an event with general subjectId: ""', async () => {
    const created = await createCalendarEvent({
      title: 'General event',
      subjectId: '',
      startAt: '2026-08-01T14:00:00.000Z',
      endAt: '2026-08-01T15:30:00.000Z',
      location: 'Room 1',
    }, { expectedGeneration: 1 })

    expect(created.subjectId).toBe('')
    expect(await studyDb.events.get(created.id)).toEqual(created)
  })

  it('rejects createCalendarEvent when subjectId does not exist and leaves events store empty', async () => {
    let thrownError: unknown = null
    try {
      await createCalendarEvent({
        title: 'Orphan event',
        subjectId: 'subject-nonexistent',
        startAt: '2026-08-01T14:00:00.000Z',
        endAt: '2026-08-01T15:30:00.000Z',
        location: '',
      }, { expectedGeneration: 1 })
    } catch (err) {
      thrownError = err
    }

    expect(thrownError).toBeInstanceOf(SubjectNotFoundError)
    expect((thrownError as SubjectNotFoundError).code).toBe('subject_not_found')
    expect((thrownError as SubjectNotFoundError).subjectId).toBe('subject-nonexistent')
    expect(await studyDb.events.count()).toBe(0)
  })

  it('rejects createCalendarEvent when generation is stale', async () => {
    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 3 })

    await expect(createCalendarEvent({
      title: 'Stale event',
      subjectId: '',
      startAt: '2026-08-01T14:00:00.000Z',
      endAt: '2026-08-01T15:30:00.000Z',
      location: '',
    }, { expectedGeneration: 2 })).rejects.toThrow(StaleDatabaseGenerationError)

    expect(await studyDb.events.count()).toBe(0)
  })

  it('updates editable fields and refreshes updatedAt while preserving createdAt', async () => {
    await studyDb.subjects.add({
      id: 'subject-chem',
      name: 'Chemistry',
      color: '#10b981',
      targetHours: 8,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    const original = await createCalendarEvent({
      title: 'Original',
      subjectId: '',
      startAt: '2026-08-02T10:00:00.000Z',
      endAt: '2026-08-02T11:00:00.000Z',
      location: 'Hall A',
    }, { expectedGeneration: 1 })

    await updateCalendarEvent(original.id, {
      title: 'Renamed',
      subjectId: 'subject-chem',
      startAt: '2026-08-03T16:15:00.000Z',
      endAt: '2026-08-03T17:00:00.000Z',
      location: 'Hall B',
    }, { expectedGeneration: 1 })

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

  it('rejects updateCalendarEvent when assigning a nonexistent subjectId and preserves original event', async () => {
    const original = await createCalendarEvent({
      title: 'Preserve event',
      subjectId: '',
      startAt: '2026-08-02T10:00:00.000Z',
      endAt: '2026-08-02T11:00:00.000Z',
      location: 'Hall A',
    }, { expectedGeneration: 1 })

    let thrownError: unknown = null
    try {
      await updateCalendarEvent(original.id, {
        title: 'Attempted event rename',
        subjectId: 'subject-ghost',
        startAt: '2026-08-03T16:15:00.000Z',
        endAt: '2026-08-03T17:00:00.000Z',
        location: 'Hall B',
      }, { expectedGeneration: 1 })
    } catch (err) {
      thrownError = err
    }

    expect(thrownError).toBeInstanceOf(SubjectNotFoundError)
    expect((thrownError as SubjectNotFoundError).subjectId).toBe('subject-ghost')

    const stored = await studyDb.events.get(original.id)
    expect(stored).toEqual(original)
  })

  it('throws when updating a missing event', async () => {
    await expect(updateCalendarEvent('event-missing', {
      title: 'Gone',
      subjectId: '',
      startAt: '2026-08-01T09:00:00.000Z',
      endAt: '2026-08-01T10:00:00.000Z',
      location: '',
    }, { expectedGeneration: 1 })).rejects.toThrow('Event no longer exists.')
  })

  it('rejects updateCalendarEvent when generation is stale', async () => {
    const original = await createCalendarEvent({
      title: 'Preserve event',
      subjectId: '',
      startAt: '2026-08-02T10:00:00.000Z',
      endAt: '2026-08-02T11:00:00.000Z',
      location: 'Hall A',
    }, { expectedGeneration: 1 })

    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 2 })

    await expect(updateCalendarEvent(original.id, {
      title: 'Stale rename',
      subjectId: '',
      startAt: '2026-08-03T16:15:00.000Z',
      endAt: '2026-08-03T17:00:00.000Z',
      location: 'Hall B',
    }, { expectedGeneration: 1 })).rejects.toThrow(StaleDatabaseGenerationError)
  })

  it('deletes an existing event', async () => {
    const created = await createCalendarEvent({
      title: 'Temporary',
      subjectId: '',
      startAt: '2026-08-04T09:00:00.000Z',
      endAt: '2026-08-04T10:00:00.000Z',
      location: 'Lab',
    }, { expectedGeneration: 1 })

    await deleteCalendarEvent(created.id, { expectedGeneration: 1 })
    expect(await studyDb.events.get(created.id)).toBeUndefined()
  })

  it('treats deleting a missing event as success', async () => {
    await expect(deleteCalendarEvent('event-already-gone', { expectedGeneration: 1 })).resolves.toBeUndefined()
    expect(await studyDb.events.count()).toBe(0)
  })

  it('rejects deleteCalendarEvent when generation is stale', async () => {
    const created = await createCalendarEvent({
      title: 'Temporary',
      subjectId: '',
      startAt: '2026-08-04T09:00:00.000Z',
      endAt: '2026-08-04T10:00:00.000Z',
      location: 'Lab',
    }, { expectedGeneration: 1 })

    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 2 })

    await expect(deleteCalendarEvent(created.id, { expectedGeneration: 1 })).rejects.toThrow(StaleDatabaseGenerationError)
    expect(await studyDb.events.get(created.id)).toBeDefined()
  })
})
