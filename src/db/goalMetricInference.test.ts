import { describe, expect, it } from 'vitest'
import { inferLegacyGoalMetric } from './goalMetricInference'
import { isGoalMetric } from './types'

describe('isGoalMetric', () => {
  it('accepts only manual and study_time', () => {
    expect(isGoalMetric('manual')).toBe(true)
    expect(isGoalMetric('study_time')).toBe(true)
    expect(isGoalMetric('derived')).toBe(false)
    expect(isGoalMetric('')).toBe(false)
    expect(isGoalMetric(null)).toBe(false)
    expect(isGoalMetric(undefined)).toBe(false)
    expect(isGoalMetric(1)).toBe(false)
    expect(isGoalMetric({ metric: 'manual' })).toBe(false)
  })
})

describe('inferLegacyGoalMetric', () => {
  it('maps daily titles containing focus to study_time with case and substring matching', () => {
    expect(inferLegacyGoalMetric('daily', 'Daily Focus')).toBe('study_time')
    expect(inferLegacyGoalMetric('daily', 'FOCUS minutes')).toBe('study_time')
    expect(inferLegacyGoalMetric('daily', 'deepfocusblock')).toBe('study_time')
  })

  it('maps weekly titles containing study or focus to study_time', () => {
    expect(inferLegacyGoalMetric('weekly', 'Weekly study hours')).toBe('study_time')
    expect(inferLegacyGoalMetric('weekly', 'Focus week')).toBe('study_time')
    expect(inferLegacyGoalMetric('weekly', 'STUDY')).toBe('study_time')
  })

  it('keeps daily titles with only study as manual', () => {
    expect(inferLegacyGoalMetric('daily', 'Study 2 hours daily')).toBe('manual')
  })

  it('keeps weekly titles without study or focus as manual', () => {
    expect(inferLegacyGoalMetric('weekly', 'Read chapters')).toBe('manual')
  })

  it('keeps every monthly title as manual', () => {
    expect(inferLegacyGoalMetric('monthly', 'Monthly focus')).toBe('manual')
    expect(inferLegacyGoalMetric('monthly', 'Monthly study')).toBe('manual')
    expect(inferLegacyGoalMetric('monthly', 'Books finished')).toBe('manual')
  })
})
