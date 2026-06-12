import { describe, it, expect } from 'vitest'
import { getEffectiveDailyGoal, getTodayCategoryStudyMinutes } from '../studyDashboard'
import type { CategoryItem, HistoryEntry } from '../../../db/types'

describe('category daily goals', () => {
  it('uses category goal when set', () => {
    const category: CategoryItem = { id: 1, name: 'Math', color: '#fff', dailyGoalMinutes: 120 }
    expect(getEffectiveDailyGoal(category, 480)).toBe(120)
  })

  it('falls back to global goal', () => {
    expect(getEffectiveDailyGoal({ id: 1, name: 'Math', color: '#fff' }, 480)).toBe(480)
  })

  it('sums today study minutes for a category', () => {
    const history: HistoryEntry[] = [
      { timestamp: '2026-06-11 10:00', createdAt: 1, type: 'study', durationMinutes: 30, categoryId: 2 },
      { timestamp: '2026-06-11 12:00', createdAt: 2, type: 'study', durationMinutes: 15, categoryId: 2 },
      { timestamp: '2026-06-11 13:00', createdAt: 3, type: 'break', durationMinutes: 5, categoryId: 2 },
    ]
    expect(getTodayCategoryStudyMinutes(history, 2, '2026-06-11')).toBe(45)
  })
})
