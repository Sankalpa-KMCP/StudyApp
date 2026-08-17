import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listSubjects } from './subjectRead'
import { studyDb } from './studyDb'

describe('subjectRead', () => {
  beforeEach(async () => {
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('returns subjects ordered by createdAt ascending', async () => {
    await studyDb.subjects.bulkPut([
      {
        id: 'subject-later',
        name: 'Later',
        color: '#0f766e',
        targetHours: 2,
        progress: 0,
        progressMode: 'manual',
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T00:00:00.000Z',
      },
      {
        id: 'subject-earlier',
        name: 'Earlier',
        color: '#2563eb',
        targetHours: 3,
        progress: 10,
        progressMode: 'manual',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
    ])

    await expect(listSubjects()).resolves.toEqual([
      expect.objectContaining({ id: 'subject-earlier', name: 'Earlier' }),
      expect.objectContaining({ id: 'subject-later', name: 'Later' }),
    ])
  })

  it('returns an empty array when no subjects exist', async () => {
    await expect(listSubjects()).resolves.toEqual([])
  })

  it('preserves Dexie order for equal createdAt timestamps', async () => {
    const sharedCreatedAt = '2026-07-01T12:00:00.000Z'
    await studyDb.subjects.bulkPut([
      {
        id: 'subject-a',
        name: 'Alpha',
        color: '#2563eb',
        targetHours: 1,
        progress: 0,
        progressMode: 'manual',
        createdAt: sharedCreatedAt,
        updatedAt: sharedCreatedAt,
      },
      {
        id: 'subject-b',
        name: 'Beta',
        color: '#0f766e',
        targetHours: 1,
        progress: 0,
        progressMode: 'manual',
        createdAt: sharedCreatedAt,
        updatedAt: sharedCreatedAt,
      },
    ])

    const listed = await listSubjects()
    expect(listed).toHaveLength(2)
    expect(listed.every((subject) => subject.createdAt === sharedCreatedAt)).toBe(true)
    expect(listed.map((subject) => subject.id).sort()).toEqual(['subject-a', 'subject-b'])
    expect(listed.map((subject) => subject.id)).toEqual(
      (await studyDb.subjects.orderBy('createdAt').toArray()).map((subject) => subject.id),
    )
  })
})
