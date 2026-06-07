import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { resetDatabase } from '../../test/dbTestUtils'
import { addFlashcard, deleteFlashcard, submitFlashcardGrade, computeNextReviewDate } from '../repositories/flashcards'
import { updateSetting } from '../repositories/settings'

describe('flashcards repository', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('addFlashcard uses initial easiness factor from settings', async () => {
    await updateSetting('initialEasinessFactor', 2.7)
    await addFlashcard('Q', 'A')
    const card = (await db.flashcards.toArray())[0]
    expect(card?.easinessFactor).toBe(2.7)
    expect(card?.repetitionCount).toBe(0)
  })

  it('deleteFlashcard removes card', async () => {
    await addFlashcard('Q', 'A')
    const id = (await db.flashcards.toArray())[0].id!
    await deleteFlashcard(id)
    expect(await db.flashcards.count()).toBe(0)
  })

  it('submitFlashcardGrade updates scheduling fields', async () => {
    await addFlashcard('Q', 'A')
    const id = (await db.flashcards.toArray())[0].id!
    await submitFlashcardGrade(id, 4)
    const card = await db.flashcards.get(id)
    expect(card?.latestGrade).toBe(4)
    expect(card?.nextReviewDate).toBeTruthy()
    expect(card?.repetitionCount).toBeGreaterThan(0)
  })

  it('computeNextReviewDate returns future date string', () => {
    const date = computeNextReviewDate(3)
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
