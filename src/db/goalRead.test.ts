import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listGoals } from './goalRead'
import { studyDb } from './studyDb'

describe('goalRead', () => {
  beforeEach(async () => {
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('returns goals ordered by createdAt ascending like getStudyData', async () => {
    await studyDb.goals.bulkAdd([
      {
        id: 'goal-later',
        title: 'Later',
        target: 30,
        progress: 0,
        period: 'daily',
        metric: 'manual',
        createdAt: '2026-07-02T12:00:00.000Z',
        updatedAt: '2026-07-02T12:00:00.000Z',
      },
      {
        id: 'goal-earlier',
        title: 'Earlier',
        target: 60,
        progress: 0,
        period: 'weekly',
        metric: 'manual',
        createdAt: '2026-07-01T12:00:00.000Z',
        updatedAt: '2026-07-01T12:00:00.000Z',
      },
      {
        id: 'goal-middle',
        title: 'Middle',
        target: 90,
        progress: 0,
        period: 'monthly',
        metric: 'study_time',
        createdAt: '2026-07-01T18:00:00.000Z',
        updatedAt: '2026-07-01T18:00:00.000Z',
      },
    ])

    const goals = await listGoals()
    expect(goals.map((goal) => goal.id)).toEqual(['goal-earlier', 'goal-middle', 'goal-later'])
  })
})
