import { describe, expect, it } from 'vitest'
import { getDefaultNoteColor, parseNoteTagColorsArray } from '../noteTagColors'

describe('getDefaultNoteColor', () => {
  it('returns the first configured note-tag color', () => {
    expect(getDefaultNoteColor(['#06b6d4', '#3b82f6'])).toBe('#06b6d4')
  })

  it('falls back to accent blue CSS variable when palette is empty', () => {
    expect(getDefaultNoteColor([])).toBe('var(--color-accent-blue)')
  })
})

describe('parseNoteTagColorsArray', () => {
  it('returns normalized hex colors in order', () => {
    expect(parseNoteTagColorsArray(['#06b6d4', '#3b82f6'])).toEqual(['#06b6d4', '#3b82f6'])
  })

  it('filters invalid entries and preserves duplicates', () => {
    expect(parseNoteTagColorsArray(['#06b6d4', 'blue', '#06b6d4', 42, null])).toEqual([
      '#06b6d4',
      '#06b6d4',
    ])
  })

  it('limits to eight colors', () => {
    const input = Array.from({ length: 10 }, (_, i) => `#${String(i).padStart(6, '0')}`)
    expect(parseNoteTagColorsArray(input)).toHaveLength(8)
    expect(parseNoteTagColorsArray(input)).toEqual(input.slice(0, 8))
  })

  it('returns null for non-array values', () => {
    expect(parseNoteTagColorsArray('not-an-array')).toBeNull()
    expect(parseNoteTagColorsArray({ colors: ['#06b6d4'] })).toBeNull()
  })

  it('returns null when no valid colors remain', () => {
    expect(parseNoteTagColorsArray([])).toBeNull()
    expect(parseNoteTagColorsArray(['blue', 'red'])).toBeNull()
  })
})
