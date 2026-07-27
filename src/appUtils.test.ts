import { afterEach, describe, expect, it, vi } from 'vitest'
import { getGoalProgress, getSubjectProgress, nextFlashcardSchedule, isFlashcardDue, getWeeklyStudyDays } from './appUtils'

describe('appUtils', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns weekly study labels for the actual trailing seven days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-29T12:00:00.000Z'))

    const days = getWeeklyStudyDays([])

    expect(days.map((day) => day.key)).toEqual([
      '2026-06-23',
      '2026-06-24',
      '2026-06-25',
      '2026-06-26',
      '2026-06-27',
      '2026-06-28',
      '2026-06-29',
    ])
    expect(days.map((day) => day.label)).toEqual(['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'])
  })

  it('derives progress from study sessions and focus goals', () => {
    expect(getSubjectProgress({
      id: 'math',
      name: 'Math',
      color: '#111827',
      targetHours: 2,
      progress: 10,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    }, [{
      id: 'session-1',
      subjectId: 'math',
      startedAt: '2026-06-29T09:00:00.000Z',
      endedAt: '2026-06-29T10:00:00.000Z',
      minutes: 60,
      note: 'Focus session',
    }])).toBe(50)

    expect(getGoalProgress({
      id: 'goal-1',
      title: 'Daily focus',
      target: 120,
      progress: 0,
      period: 'daily',
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    }, 45, 0)).toBe(45)
  })

  it('schedules flashcard reviews locally', () => {
    const now = new Date('2026-06-29T00:00:00.000Z')
    const card = {
      id: 'card-1',
      front: 'Term',
      back: 'Definition',
      subjectId: '',
      status: 'new' as const,
      lastReviewedAt: '',
      intervalDays: 0,
      reviewCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

    const remembered = nextFlashcardSchedule(card, 'remembered', now)

    expect(remembered.intervalDays).toBe(3)
    expect(remembered.reviewCount).toBe(1)
    expect(isFlashcardDue({ ...card, ...remembered }, now)).toBe(false)
  })
})
