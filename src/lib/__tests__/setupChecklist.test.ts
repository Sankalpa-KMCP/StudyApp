import { describe, it, expect, beforeEach } from 'vitest'
import {
  DAILY_GOAL_CONFIGURED_KEY,
  isDailyGoalConfigured,
  markDailyGoalConfigured,
} from '../setupChecklist'

describe('setupChecklist', () => {
  beforeEach(() => {
    localStorage.removeItem(DAILY_GOAL_CONFIGURED_KEY)
  })

  it('starts unconfigured', () => {
    expect(isDailyGoalConfigured()).toBe(false)
  })

  it('marks daily goal configured', () => {
    markDailyGoalConfigured()
    expect(isDailyGoalConfigured()).toBe(true)
  })
})
