import { describe, expect, it } from 'vitest'
import { DEFAULT_NOTE_TAG_COLORS } from '../../lib/settings/settingsDefaults'
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

  it('parses valid noteTagColors JSON from rows', () => {
    const s = settingsFromRows([
      { key: 'noteTagColors', value: '["#06b6d4","#3b82f6"]' },
    ])
    expect(s.noteTagColors).toEqual(['#06b6d4', '#3b82f6'])
  })

  it('falls back to default noteTagColors for invalid JSON', () => {
    const s = settingsFromRows([
      { key: 'noteTagColors', value: 'not-json' },
    ])
    expect(s.noteTagColors).toEqual([...DEFAULT_NOTE_TAG_COLORS])
  })

  it('falls back to default noteTagColors for empty or invalid arrays', () => {
    expect(settingsFromRows([{ key: 'noteTagColors', value: '[]' }]).noteTagColors).toEqual([
      ...DEFAULT_NOTE_TAG_COLORS,
    ])
    expect(settingsFromRows([{ key: 'noteTagColors', value: '["blue"]' }]).noteTagColors).toEqual([
      ...DEFAULT_NOTE_TAG_COLORS,
    ])
    expect(settingsFromRows([{ key: 'noteTagColors', value: '{"colors":[]}' }]).noteTagColors).toEqual([
      ...DEFAULT_NOTE_TAG_COLORS,
    ])
  })
})
