import { describe, expect, it } from 'vitest'
import { computeNextReviewDate } from '../repositories/flashcards'

describe('computeNextReviewDate', () => {
  it('returns a YYYY-MM-DD string offset by interval days', () => {
    const result = computeNextReviewDate(3)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const today = new Date()
    const expected = new Date()
    expected.setDate(today.getDate() + 3)
    const expectedStr = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`
    expect(result).toBe(expectedStr)
  })
})
