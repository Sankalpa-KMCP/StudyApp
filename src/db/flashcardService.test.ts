import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextFlashcardSchedule } from '../appUtils'
import {
  createFlashcard,
  deleteFlashcard,
  reviewFlashcard,
  updateFlashcard,
} from './flashcardService'
import { studyDb } from './studyDb'

describe('flashcardService', () => {
  beforeEach(async () => {
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('creates a new flashcard with review defaults and matching timestamps', async () => {
    const created = await createFlashcard({
      front: 'Derivative rule',
      back: 'Power rule',
      subjectId: 'subject-math',
    })

    expect(created.id).toMatch(/^card-/)
    expect(created).toMatchObject({
      front: 'Derivative rule',
      back: 'Power rule',
      subjectId: 'subject-math',
      status: 'new',
      lastReviewedAt: '',
      intervalDays: 0,
      reviewCount: 0,
    })
    expect(created.dueAt).toBe(created.createdAt)
    expect(created.createdAt).toBe(created.updatedAt)
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false)
    expect(await studyDb.flashcards.get(created.id)).toEqual(created)
  })

  it('updates editable fields and refreshes updatedAt while preserving review state', async () => {
    const original = await createFlashcard({
      front: 'Original front',
      back: 'Original back',
      subjectId: '',
    })

    await updateFlashcard(original.id, {
      front: 'Edited front',
      back: 'Edited back',
      subjectId: 'subject-chem',
    })

    const stored = await studyDb.flashcards.get(original.id)
    expect(stored).toMatchObject({
      id: original.id,
      front: 'Edited front',
      back: 'Edited back',
      subjectId: 'subject-chem',
      status: 'new',
      lastReviewedAt: '',
      dueAt: original.dueAt,
      intervalDays: 0,
      reviewCount: 0,
      createdAt: original.createdAt,
    })
    expect(Date.parse(stored!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(original.createdAt))
  })

  it('throws when updating a missing flashcard', async () => {
    await expect(updateFlashcard('card-missing', {
      front: 'Gone',
      back: 'Gone',
      subjectId: '',
    })).rejects.toThrow('Flashcard no longer exists.')
  })

  it('records a remembered review using the shared scheduling helper', async () => {
    const original = await createFlashcard({
      front: 'Review me',
      back: 'Answer',
      subjectId: '',
    })

    await reviewFlashcard(original, 'remembered')

    const stored = await studyDb.flashcards.get(original.id)
    expect(stored).toMatchObject({
      id: original.id,
      status: 'remembered',
      createdAt: original.createdAt,
    })
    expect(stored!.lastReviewedAt).toBe(stored!.updatedAt)
    expect(Number.isNaN(Date.parse(stored!.lastReviewedAt))).toBe(false)

    const expected = nextFlashcardSchedule(original, 'remembered', new Date(stored!.lastReviewedAt))
    expect(stored).toMatchObject({
      intervalDays: expected.intervalDays,
      dueAt: expected.dueAt,
      reviewCount: expected.reviewCount,
    })
  })

  it('throws when reviewing a missing flashcard', async () => {
    const missing = {
      id: 'card-missing-review',
      front: 'Missing',
      back: 'Missing',
      subjectId: '',
      status: 'new' as const,
      lastReviewedAt: '',
      dueAt: '2026-06-29T00:00:00.000Z',
      intervalDays: 0,
      reviewCount: 0,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    }

    await expect(reviewFlashcard(missing, 'learning')).rejects.toThrow('Flashcard no longer exists.')
  })

  it('deletes an existing flashcard', async () => {
    const created = await createFlashcard({
      front: 'Temporary',
      back: 'Gone soon',
      subjectId: '',
    })

    await deleteFlashcard(created.id)
    expect(await studyDb.flashcards.get(created.id)).toBeUndefined()
  })

  it('treats deleting a missing flashcard as success', async () => {
    await expect(deleteFlashcard('card-already-gone')).resolves.toBeUndefined()
    expect(await studyDb.flashcards.count()).toBe(0)
  })
})
