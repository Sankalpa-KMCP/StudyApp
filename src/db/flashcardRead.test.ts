import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listFlashcards } from './flashcardRead'
import { studyDb } from './studyDb'

describe('flashcardRead', () => {
  beforeEach(async () => {
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('returns an empty array when no flashcards exist', async () => {
    expect(await listFlashcards()).toEqual([])
  })

  it('returns flashcards ordered by createdAt ascending like getStudyData', async () => {
    await studyDb.flashcards.bulkAdd([
      {
        id: 'card-later',
        front: 'Later',
        back: 'a',
        subjectId: '',
        status: 'new',
        lastReviewedAt: '',
        createdAt: '2026-07-03T12:00:00.000Z',
        updatedAt: '2026-07-03T12:00:00.000Z',
      },
      {
        id: 'card-earliest',
        front: 'Earliest',
        back: 'b',
        subjectId: '',
        status: 'learning',
        lastReviewedAt: '',
        dueAt: '2026-07-01T09:00:00.000Z',
        createdAt: '2026-07-01T09:00:00.000Z',
        updatedAt: '2026-07-01T09:00:00.000Z',
      },
      {
        id: 'card-middle',
        front: 'Middle',
        back: 'c',
        subjectId: '',
        status: 'new',
        lastReviewedAt: '',
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T00:00:00.000Z',
      },
    ])

    const cards = await listFlashcards()
    expect(cards.map((card) => card.id)).toEqual(['card-earliest', 'card-middle', 'card-later'])
  })

  it('keeps equal createdAt rows adjacent and stable relative to insert order under Dexie ordering', async () => {
    const sharedCreated = '2026-07-02T10:00:00.000Z'
    await studyDb.flashcards.bulkAdd([
      {
        id: 'card-tie-a',
        front: 'Tie A',
        back: 'a',
        subjectId: '',
        status: 'new',
        lastReviewedAt: '',
        createdAt: sharedCreated,
        updatedAt: sharedCreated,
      },
      {
        id: 'card-tie-b',
        front: 'Tie B',
        back: 'b',
        subjectId: '',
        status: 'new',
        lastReviewedAt: '',
        createdAt: sharedCreated,
        updatedAt: sharedCreated,
      },
      {
        id: 'card-after',
        front: 'After',
        back: 'c',
        subjectId: '',
        status: 'new',
        lastReviewedAt: '',
        createdAt: '2026-07-02T11:00:00.000Z',
        updatedAt: '2026-07-02T11:00:00.000Z',
      },
    ])

    const cards = await listFlashcards()
    expect(cards.map((card) => card.id)).toEqual(['card-tie-a', 'card-tie-b', 'card-after'])
    expect(cards[0]?.createdAt).toBe(sharedCreated)
    expect(cards[1]?.createdAt).toBe(sharedCreated)
  })
})
