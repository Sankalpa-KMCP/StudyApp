import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listCalendarEvents } from './calendarEventRead'
import { studyDb } from './studyDb'

describe('calendarEventRead', () => {
  beforeEach(async () => {
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('returns an empty array when no events exist', async () => {
    expect(await listCalendarEvents()).toEqual([])
  })

  it('returns events ordered by startAt ascending like getStudyData', async () => {
    await studyDb.events.bulkAdd([
      {
        id: 'event-later',
        title: 'Later',
        subjectId: '',
        startAt: '2026-07-03T12:00:00.000Z',
        endAt: '2026-07-03T13:00:00.000Z',
        location: '',
        createdAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-01T10:00:00.000Z',
      },
      {
        id: 'event-earliest',
        title: 'Earliest',
        subjectId: '',
        startAt: '2026-07-01T09:00:00.000Z',
        endAt: '2026-07-01T10:00:00.000Z',
        location: 'Room A',
        createdAt: '2026-07-01T08:00:00.000Z',
        updatedAt: '2026-07-01T08:00:00.000Z',
      },
      {
        id: 'event-middle',
        title: 'Middle',
        subjectId: '',
        startAt: '2026-07-02T00:00:00.000Z',
        endAt: '2026-07-02T01:00:00.000Z',
        location: '',
        createdAt: '2026-07-01T11:00:00.000Z',
        updatedAt: '2026-07-01T11:00:00.000Z',
      },
    ])

    const events = await listCalendarEvents()
    expect(events.map((event) => event.id)).toEqual(['event-earliest', 'event-middle', 'event-later'])
  })

  it('keeps equal startAt rows adjacent and stable relative to insert order under Dexie ordering', async () => {
    const sharedStart = '2026-07-02T10:00:00.000Z'
    await studyDb.events.bulkAdd([
      {
        id: 'event-tie-a',
        title: 'Tie A',
        subjectId: '',
        startAt: sharedStart,
        endAt: '2026-07-02T11:00:00.000Z',
        location: '',
        createdAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-01T10:00:00.000Z',
      },
      {
        id: 'event-tie-b',
        title: 'Tie B',
        subjectId: '',
        startAt: sharedStart,
        endAt: '2026-07-02T11:30:00.000Z',
        location: '',
        createdAt: '2026-07-01T10:01:00.000Z',
        updatedAt: '2026-07-01T10:01:00.000Z',
      },
      {
        id: 'event-after',
        title: 'After',
        subjectId: '',
        startAt: '2026-07-02T11:00:00.000Z',
        endAt: '2026-07-02T12:00:00.000Z',
        location: '',
        createdAt: '2026-07-01T10:02:00.000Z',
        updatedAt: '2026-07-01T10:02:00.000Z',
      },
    ])

    const events = await listCalendarEvents()
    expect(events.map((event) => event.id)).toEqual(['event-tie-a', 'event-tie-b', 'event-after'])
    expect(events[0]?.startAt).toBe(sharedStart)
    expect(events[1]?.startAt).toBe(sharedStart)
  })
})
