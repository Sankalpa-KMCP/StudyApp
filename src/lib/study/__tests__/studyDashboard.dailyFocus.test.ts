import { describe, it, expect } from 'vitest'
import { getDailyFocusStatus } from '../studyDashboard'

describe('getDailyFocusStatus', () => {
  it('returns remaining time when under goal', () => {
    const status = getDailyFocusStatus(80, 480)
    expect(status.goalMet).toBe(false)
    expect(status.studiedLabel).toBe('1h 20m')
    expect(status.remainingMinutes).toBe(400)
    expect(status.remainingLabel).toBe('6h 40m left today')
    expect(status.percent).toBeCloseTo(80 / 480)
  })

  it('returns goal met when studied meets or exceeds goal', () => {
    const status = getDailyFocusStatus(500, 480)
    expect(status.goalMet).toBe(true)
    expect(status.remainingLabel).toBe('Goal met')
    expect(status.percent).toBe(1)
  })

  it('handles zero goal gracefully', () => {
    const status = getDailyFocusStatus(60, 0)
    expect(status.goalMet).toBe(false)
    expect(status.percent).toBe(0)
    expect(status.remainingLabel).toBe('No goal set')
  })
})
