import { describe, expect, it } from 'vitest'
import {
  MAX_STUDY_EXPORT_EVENTS,
  MAX_STUDY_EXPORT_GOALS,
  MAX_STUDY_EXPORT_NOTES,
  MAX_STUDY_EXPORT_SETTINGS,
  MAX_STUDY_EXPORT_STUDY_SESSIONS,
  MAX_STUDY_EXPORT_SUBJECTS,
  MAX_STUDY_EXPORT_TASKS,
  MAX_STUDY_EXPORT_TOTAL_RECORDS,
  STUDY_EXPORT_RECORD_LIMITS,
} from './studyExportLimits'

describe('studyExportLimits record ceilings', () => {
  it('exposes the production total and per-table record limits', () => {
    expect(MAX_STUDY_EXPORT_TOTAL_RECORDS).toBe(25_000)
    expect(MAX_STUDY_EXPORT_SUBJECTS).toBe(500)
    expect(MAX_STUDY_EXPORT_TASKS).toBe(5_000)
    expect(MAX_STUDY_EXPORT_NOTES).toBe(5_000)
    expect(MAX_STUDY_EXPORT_EVENTS).toBe(5_000)
    expect(MAX_STUDY_EXPORT_STUDY_SESSIONS).toBe(10_000)
    expect(MAX_STUDY_EXPORT_GOALS).toBe(500)
    expect(MAX_STUDY_EXPORT_SETTINGS).toBe(64)
    expect(STUDY_EXPORT_RECORD_LIMITS).toEqual({
      total: 25_000,
      subjects: 500,
      tasks: 5_000,
      notes: 5_000,
      events: 5_000,
      studySessions: 10_000,
      goals: 500,
      settings: 64,
    })
  })
})
