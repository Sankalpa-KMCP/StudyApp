import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  calculateGoalProgress,
  getDailyStudyMinutes,
  getGoalProgress,
  getGoalUnit,
  getMonthlyStudyHours,
  getRollingWeeklyStudyHours,
  getSubjectProgress,
  getTodayFocusMinutes,
  isDerivedGoal,
  isStudyTimeGoal,
  nextFlashcardSchedule,
  isFlashcardDue,
  getWeeklyStudyDays,
  groupStudySessionsByLocalDate,
  localDateKey,
  parseLocalDateTime,
} from './appUtils'
import type { StudyGoal } from './db/types'

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

    const now = new Date(2026, 5, 29, 12, 0)
    const sessions = [sessionAt('today', new Date(2026, 5, 29, 9, 0), 45, new Date(2026, 5, 29, 9, 45))]
    expect(getGoalProgress(goalFixture({ period: 'daily', metric: 'study_time', target: 120 }), sessions, now)).toBe(45)
  })

  describe('goal progress by explicit metric', () => {
    const now = new Date(2026, 6, 13, 15, 0)

    it('detects study_time versus manual goals without inspecting titles', () => {
      const studyGoal = goalFixture({ title: 'Read chapter 4', metric: 'study_time', period: 'weekly' })
      const manualGoal = goalFixture({ title: 'Study every day', metric: 'manual', period: 'daily' })

      expect(isStudyTimeGoal(studyGoal)).toBe(true)
      expect(isDerivedGoal(studyGoal)).toBe(true)
      expect(isStudyTimeGoal(manualGoal)).toBe(false)
      expect(isDerivedGoal(manualGoal)).toBe(false)
    })

    it('keeps rename invariance for manual and study_time goals', () => {
      const sessions = [sessionAt('today', new Date(2026, 6, 13, 10, 0), 30, new Date(2026, 6, 13, 10, 30))]
      const manual = goalFixture({ title: 'Study every day', metric: 'manual', progress: 12, target: 20 })
      const renamedManual = { ...manual, title: 'Renamed manual goal' }
      expect(calculateGoalProgress(manual, sessions, now)).toEqual(calculateGoalProgress(renamedManual, sessions, now))

      const study = goalFixture({ title: 'Daily focus', metric: 'study_time', period: 'daily', target: 60 })
      const renamedStudy = { ...study, title: 'Renamed study goal' }
      expect(calculateGoalProgress(study, sessions, now)).toEqual(calculateGoalProgress(renamedStudy, sessions, now))
    })

    it('uses stored manual progress including zero, above-target, and zero-target cases', () => {
      expect(calculateGoalProgress(goalFixture({ metric: 'manual', progress: 0, target: 10 }), [], now)).toMatchObject({
        current: 0,
        target: 10,
        percentage: 0,
        unit: 'points',
      })
      expect(calculateGoalProgress(goalFixture({ metric: 'manual', progress: 25, target: 10 }), [], now)).toMatchObject({
        current: 25,
        target: 10,
        percentage: 100,
        unit: 'points',
      })
      expect(calculateGoalProgress(goalFixture({ metric: 'manual', progress: 5, target: 0 }), [], now)).toMatchObject({
        current: 5,
        target: 0,
        percentage: 0,
        unit: 'points',
      })
    })

    it('ignores stored progress for study_time goals', () => {
      const sessions = [sessionAt('today', new Date(2026, 6, 13, 10, 0), 30, new Date(2026, 6, 13, 10, 30))]
      const result = calculateGoalProgress(goalFixture({
        metric: 'study_time',
        period: 'daily',
        progress: 999,
        target: 60,
      }), sessions, now)
      expect(result).toMatchObject({ current: 30, target: 60, percentage: 50, unit: 'minutes' })
    })

    it('counts only credited current-local-day minutes for daily study_time goals', () => {
      const sessions = [
        sessionAt('today', new Date(2026, 6, 13, 10, 0), 30, new Date(2026, 6, 13, 10, 30)),
        sessionAt('yesterday', new Date(2026, 6, 12, 10, 0), 40, new Date(2026, 6, 12, 10, 40)),
        sessionAt('future', new Date(2026, 6, 13, 16, 0), 20, new Date(2026, 6, 13, 16, 20)),
      ]
      expect(getDailyStudyMinutes(sessions, now)).toBe(30)
      expect(calculateGoalProgress(goalFixture({ metric: 'study_time', period: 'daily', target: 60 }), sessions, now)).toMatchObject({
        current: 30,
        unit: 'minutes',
      })
    })

    it('uses rolling seven-local-day rounded hours for weekly study_time goals', () => {
      const sessions = [
        sessionAt('day-6', new Date(2026, 6, 7, 9, 0), 30, new Date(2026, 6, 7, 9, 30)),
        sessionAt('day-7', new Date(2026, 6, 13, 9, 0), 90, new Date(2026, 6, 13, 10, 30)),
        sessionAt('outside-window', new Date(2026, 6, 5, 9, 0), 120, new Date(2026, 6, 5, 11, 0)),
      ]
      expect(getRollingWeeklyStudyHours(sessions, now)).toBeCloseTo(2, 5)
      expect(calculateGoalProgress(goalFixture({ metric: 'study_time', period: 'weekly', target: 5 }), sessions, now)).toMatchObject({
        current: 2,
        unit: 'hours',
        percentage: 40,
      })
    })

    it('uses current local calendar month hours for monthly study_time goals', () => {
      const sessions = [
        sessionAt('this-month', new Date(2026, 6, 5, 9, 0), 60, new Date(2026, 6, 5, 10, 0)),
        sessionAt('this-month-2', new Date(2026, 6, 13, 9, 0), 90, new Date(2026, 6, 13, 10, 30)),
        sessionAt('last-month', new Date(2026, 5, 30, 9, 0), 120, new Date(2026, 5, 30, 11, 0)),
      ]
      expect(getMonthlyStudyHours(sessions, now)).toBeCloseTo(2.5, 5)
      expect(calculateGoalProgress(goalFixture({ metric: 'study_time', period: 'monthly', target: 4 }), sessions, now)).toMatchObject({
        current: 3,
        unit: 'hours',
        percentage: 75,
      })
    })

    it('totals multiple qualifying sessions and includes general or deleted-subject sessions', () => {
      const sessions = [
        { ...sessionAt('general', new Date(2026, 6, 13, 8, 0), 20, new Date(2026, 6, 13, 8, 20)), subjectId: '' },
        { ...sessionAt('deleted', new Date(2026, 6, 13, 9, 0), 10, new Date(2026, 6, 13, 9, 10)), subjectId: 'missing-subject' },
      ]
      expect(getDailyStudyMinutes(sessions, now)).toBe(30)
    })

    it('exposes goal units by metric and period', () => {
      expect(getGoalUnit(goalFixture({ metric: 'manual' }))).toBe('points')
      expect(getGoalUnit(goalFixture({ metric: 'study_time', period: 'daily' }))).toBe('minutes')
      expect(getGoalUnit(goalFixture({ metric: 'study_time', period: 'weekly' }))).toBe('hours')
      expect(getGoalUnit(goalFixture({ metric: 'study_time', period: 'monthly' }))).toBe('hours')
    })

    it('never returns NaN or Infinity for invalid targets', () => {
      const result = calculateGoalProgress(goalFixture({ metric: 'manual', progress: 5, target: Number.NaN }), [], now)
      expect(Number.isFinite(result.percentage)).toBe(true)
      expect(result.percentage).toBe(0)
      expect(result.target).toBe(0)
    })
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

function goalFixture(overrides: Partial<StudyGoal> = {}): StudyGoal {
  return {
    id: 'goal-1',
    title: 'Goal',
    target: 10,
    progress: 0,
    period: 'daily',
    metric: 'manual',
    createdAt: '2026-06-29T00:00:00.000Z',
    updatedAt: '2026-06-29T00:00:00.000Z',
    ...overrides,
  }
}
