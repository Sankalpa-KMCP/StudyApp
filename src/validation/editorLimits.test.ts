import { describe, expect, it } from 'vitest'
import {
  clampSubjectEditorProgress,
  clampSubjectEditorTargetHours,
  clampTaskEditorMinutes,
  SUBJECT_EDITOR_PROGRESS_MAX,
  SUBJECT_EDITOR_PROGRESS_MIN,
  SUBJECT_EDITOR_TARGET_HOURS_MAX,
  SUBJECT_EDITOR_TARGET_HOURS_MIN,
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

describe('editorLimits Subject target hours and progress', () => {
  it('exposes target-hours 1–100 and progress 0–100', () => {
    expect(SUBJECT_EDITOR_TARGET_HOURS_MIN).toBe(1)
    expect(SUBJECT_EDITOR_TARGET_HOURS_MAX).toBe(100)
    expect(SUBJECT_EDITOR_PROGRESS_MIN).toBe(0)
    expect(SUBJECT_EDITOR_PROGRESS_MAX).toBe(100)
  })

  it('clamps target hours and progress to inclusive boundaries', () => {
    expect(clampSubjectEditorTargetHours(1)).toBe(1)
    expect(clampSubjectEditorTargetHours(100)).toBe(100)
    expect(clampSubjectEditorTargetHours(0)).toBe(1)
    expect(clampSubjectEditorTargetHours(101)).toBe(100)
    expect(clampSubjectEditorTargetHours(Number.NaN)).toBe(1)

    expect(clampSubjectEditorProgress(0)).toBe(0)
    expect(clampSubjectEditorProgress(100)).toBe(100)
    expect(clampSubjectEditorProgress(-1)).toBe(0)
    expect(clampSubjectEditorProgress(101)).toBe(100)
    expect(clampSubjectEditorProgress(Number.NaN)).toBe(0)
  })
})
