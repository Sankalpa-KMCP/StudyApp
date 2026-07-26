import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listStudySessions } from './studySessionRead'
import { studyDb } from './studyDb'

describe('studySessionRead', () => {
  beforeEach(async () => {
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('returns an empty array when no study sessions exist', async () => {
    expect(await listStudySessions()).toEqual([])
  })

  it('returns sessions ordered by startedAt descending like getStudyData', async () => {
    await studyDb.studySessions.bulkAdd([
      {
        id: 'session-earliest',
        subjectId: '',
        startedAt: '2026-07-01T09:00:00.000Z',
        endedAt: '2026-07-01T09:30:00.000Z',
        minutes: 30,
        note: 'earliest',
      },
      {
        id: 'session-latest',
        subjectId: '',
        startedAt: '2026-07-03T12:00:00.000Z',
        endedAt: '2026-07-03T12:45:00.000Z',
        minutes: 45,
        note: 'latest',
      },
      {
        id: 'session-middle',
        subjectId: '',
        startedAt: '2026-07-02T00:00:00.000Z',
        endedAt: '2026-07-02T00:20:00.000Z',
        minutes: 20,
        note: 'middle',
      },
    ])

    const sessions = await listStudySessions()
    expect(sessions.map((session) => session.id)).toEqual(['session-latest', 'session-middle', 'session-earliest'])
  })

  it('keeps equal startedAt rows adjacent and stable relative to insert order under Dexie ordering', async () => {
    const sharedStarted = '2026-07-02T10:00:00.000Z'
    await studyDb.studySessions.bulkAdd([
      {
        id: 'session-tie-a',
        subjectId: '',
        startedAt: sharedStarted,
        endedAt: '2026-07-02T10:15:00.000Z',
        minutes: 15,
        note: 'tie a',
      },
      {
        id: 'session-tie-b',
        subjectId: '',
        startedAt: sharedStarted,
        endedAt: '2026-07-02T10:20:00.000Z',
        minutes: 20,
        note: 'tie b',
      },
      {
        id: 'session-earlier',
        subjectId: '',
        startedAt: '2026-07-02T09:00:00.000Z',
        endedAt: '2026-07-02T09:10:00.000Z',
        minutes: 10,
        note: 'earlier',
      },
    ])

    const sessions = await listStudySessions()
    // Dexie reverse() keeps equal keys adjacent but reverses relative insert order within the tie.
    expect(sessions.map((session) => session.id)).toEqual(['session-tie-b', 'session-tie-a', 'session-earlier'])
    expect(sessions[0]?.startedAt).toBe(sharedStarted)
    expect(sessions[1]?.startedAt).toBe(sharedStarted)
  })
})
