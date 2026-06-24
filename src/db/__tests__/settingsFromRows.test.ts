import { describe, expect, it } from 'vitest'
import { settingsFromRows } from '../selectors/settingsFromRows'

describe('settingsFromRows', () => {
  it('returns defaults when rows are undefined', () => {
    const s = settingsFromRows(undefined)
    expect(s.dailyGoalMinutes).toBe(120)
    expect(s.theme).toBe('paper-day')
    expect(s.studyBlockDurationMinutes).toBe(25)
  })

  it('maps row values over defaults', () => {
    const s = settingsFromRows([
      { key: 'dailyGoalMinutes', value: 120 },
      { key: 'theme', value: 'nordic-frost' },
      { key: 'soundEnabled', value: false },
    ])
    expect(s.dailyGoalMinutes).toBe(120)
    expect(s.theme).toBe('nordic-frost')
    expect(s.soundEnabled).toBe(false)
    expect(s.studyBlockDurationMinutes).toBe(25)
  })
})
