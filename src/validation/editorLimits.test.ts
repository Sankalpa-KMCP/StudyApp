import { describe, expect, it } from 'vitest'
import {
  clampTaskEditorMinutes,
  TASK_EDITOR_MINUTES_MAX,
  TASK_EDITOR_MINUTES_MIN,
} from './editorLimits'

describe('editorLimits Task minutes', () => {
  it('exposes the editor usability range 5–720', () => {
    expect(TASK_EDITOR_MINUTES_MIN).toBe(5)
    expect(TASK_EDITOR_MINUTES_MAX).toBe(720)
  })

  it('clamps to inclusive boundaries and maps non-finite input to the minimum', () => {
    expect(clampTaskEditorMinutes(5)).toBe(5)
    expect(clampTaskEditorMinutes(720)).toBe(720)
    expect(clampTaskEditorMinutes(4)).toBe(5)
    expect(clampTaskEditorMinutes(721)).toBe(720)
    expect(clampTaskEditorMinutes(Number.NaN)).toBe(5)
    expect(clampTaskEditorMinutes(Number.POSITIVE_INFINITY)).toBe(5)
  })
})
