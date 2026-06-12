import { describe, it, expect } from 'vitest'
import { shouldRunAutoExport } from '../autoExportSchedule'

describe('shouldRunAutoExport', () => {
  const now = Date.UTC(2026, 5, 12)

  it('returns false when never exported (requires a prior manual export)', () => {
    expect(shouldRunAutoExport(null, 7, now)).toBe(false)
  })

  it('returns false when interval not elapsed', () => {
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000
    expect(shouldRunAutoExport(threeDaysAgo, 7, now)).toBe(false)
  })

  it('returns true when interval elapsed', () => {
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000
    expect(shouldRunAutoExport(eightDaysAgo, 7, now)).toBe(true)
  })
})
