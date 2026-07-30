import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getGoalProgress,
  getSubjectProgress,
  getTodayFocusMinutes,
  nextFlashcardSchedule,
  isFlashcardDue,
  getWeeklyStudyDays,
  groupStudySessionsByLocalDate,
  localDateKey,
  parseLocalDateTime,
} from './appUtils'

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

  it('groups sessions by their local start date and sorts newest first', () => {
    const firstDayMorning = new Date(2026, 5, 29, 9, 0)
    const firstDayNight = new Date(2026, 5, 29, 23, 50)
    const nextDay = new Date(2026, 5, 30, 8, 0)
    const sessions = [
      sessionAt('morning', firstDayMorning, 30),
      sessionAt('next-day', nextDay, 20),
      sessionAt('night', firstDayNight, 30),
    ]

    const groups = groupStudySessionsByLocalDate(sessions, new Date(2026, 5, 30, 12, 0))

    expect(groups.map((group) => group.key)).toEqual([localDateKey(nextDay), localDateKey(firstDayNight)])
    expect(groups[0].label).toBe('Today')
    expect(groups[1].label).toBe('Yesterday')
    expect(groups[1].sessions.map((session) => session.id)).toEqual(['night', 'morning'])
  })

  it('uses local calendar dates for today totals and parses valid local timestamps', () => {
    vi.useFakeTimers()
    const now = new Date(2026, 5, 29, 0, 30)
    vi.setSystemTime(now)
    const endedToday = new Date(2026, 5, 29, 0, 10)
    const endedYesterday = new Date(2026, 5, 28, 23, 50)

    expect(getTodayFocusMinutes([
      sessionAt('today', new Date(2026, 5, 28, 23, 45), 25, endedToday),
      sessionAt('yesterday', new Date(2026, 5, 28, 23, 20), 30, endedYesterday),
    ])).toBe(25)

    const week = getWeeklyStudyDays([
      sessionAt('cross-midnight', new Date(2026, 5, 28, 23, 45), 25, endedToday),
      sessionAt('sunday', new Date(2026, 5, 28, 23, 20), 30, endedYesterday),
    ])
    expect(week.at(-2)?.key).toBe(localDateKey(endedYesterday))
    expect(week.at(-2)?.hours).toBe(0.5)
    expect(week.at(-1)?.key).toBe(localDateKey(endedToday))
    expect(week.at(-1)?.hours).toBe(25 / 60)

    const parsed = parseLocalDateTime(localDateKey(now), '00:05')
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(5)
    expect(parsed?.getDate()).toBe(29)
    expect(parseLocalDateTime('2026-02-30', '09:00')).toBeNull()
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

function sessionAt(id: string, startedAt: Date, minutes: number, endedAt = new Date(startedAt.getTime() + minutes * 60_000)) {
  return {
    id,
    subjectId: '',
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    minutes,
    note: '',
  }
}
