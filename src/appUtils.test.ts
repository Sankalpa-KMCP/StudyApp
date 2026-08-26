import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildSearchResults,
  calculateGoalProgress,
  calculateStreak,
  calculateSubjectProgress,
  getDailyStudyMinutes,
  getGoalProgress,
  getGoalUnit,
  getMonthlyStudyHours,
  getRollingWeeklyStudyHours,
  getSubjectProgress,
  getSubjectStudyMinutes,
  getSubjectStudyMinutesMap,
  getTodayFocusMinutes,
  inferSubjectProgressMode,
  isDerivedGoal,
  isStudyTimeGoal,
  getWeeklyStudyDays,
  groupStudySessionsByLocalDate,
  localDateKey,
  parseLocalDateTime,
  startOfToday,
} from './appUtils'
import type { StudyGoal, StudySubject } from './db/types'
import { isSubjectProgressMode } from './db/types'

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

  it('localDateKey matches local calendar fields and can differ from an ISO UTC date prefix', () => {
    const localMorning = new Date(2026, 6, 23, 0, 30)
    expect(localDateKey(localMorning)).toBe('2026-07-23')
    expect(localDateKey(localMorning.toISOString())).toBe('2026-07-23')

    // Host-independent characterization via offset-shifted UTC fields (same mechanism as CalendarStrip tests).
    const aheadIso = '2026-07-22T19:00:00.000Z'
    const behindIso = '2026-07-24T01:00:00.000Z'
    const keyAtOffset = (value: string, timezoneOffsetMinutes: number) => {
      const shifted = new Date(new Date(value).getTime() - timezoneOffsetMinutes * 60_000)
      return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`
    }
    expect(aheadIso.slice(0, 10)).toBe('2026-07-22')
    expect(keyAtOffset(aheadIso, -330)).toBe('2026-07-23')
    expect(behindIso.slice(0, 10)).toBe('2026-07-24')
    expect(keyAtOffset(behindIso, 300)).toBe('2026-07-23')
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

  it('accepts an explicit now for today focus, streak, and start-of-day floor', () => {
    const dayOne = new Date(2026, 6, 13, 23, 0)
    const dayTwo = new Date(2026, 6, 14, 0, 30)
    const sessions = [
      sessionAt('logged', new Date(2026, 6, 13, 10, 0), 45, new Date(2026, 6, 13, 10, 45)),
    ]

    expect(getTodayFocusMinutes(sessions, dayOne)).toBe(45)
    expect(getTodayFocusMinutes(sessions, dayTwo)).toBe(0)
    expect(calculateStreak(sessions, dayOne)).toBe(1)
    expect(calculateStreak(sessions, dayTwo)).toBe(0)
    expect(startOfToday(dayOne)).toBe(new Date(2026, 6, 13, 0, 0, 0, 0).getTime())
    expect(startOfToday(dayTwo)).toBe(new Date(2026, 6, 14, 0, 0, 0, 0).getTime())
    expect(getWeeklyStudyDays(sessions, dayTwo).at(-1)?.key).toBe(localDateKey(dayTwo))
  })

  it('calculates subject progress from the explicit stored mode', () => {
    const sessions = [{
      id: 'session-1',
      subjectId: 'math',
      startedAt: '2026-06-29T09:00:00.000Z',
      endedAt: '2026-06-29T10:00:00.000Z',
      minutes: 60,
      note: 'Focus session',
    }]
    const manualSubject = subjectFixture({ progressMode: 'manual', progress: 10, targetHours: 2 })
    const studySubject = subjectFixture({ progressMode: 'study_time', progress: 10, targetHours: 2 })

    expect(calculateSubjectProgress(manualSubject, sessions)).toEqual({
      percentage: 10,
      mode: 'manual',
      loggedMinutes: 60,
      targetMinutes: 120,
    })
    expect(calculateSubjectProgress(studySubject, sessions)).toEqual({
      percentage: 50,
      mode: 'study_time',
      loggedMinutes: 60,
      targetMinutes: 120,
    })
    expect(getSubjectProgress(studySubject, sessions)).toBe(50)
    expect(getSubjectProgress(manualSubject, sessions)).toBe(10)
    expect(inferSubjectProgressMode('math', sessions)).toBe('study_time')
    expect(inferSubjectProgressMode('other', sessions)).toBe('manual')
    expect(isSubjectProgressMode('manual')).toBe(true)
    expect(isSubjectProgressMode('study_time')).toBe(true)
    expect(isSubjectProgressMode('derived')).toBe(false)

    const now = new Date(2026, 5, 29, 12, 0)
    const goalSessions = [sessionAt('today', new Date(2026, 5, 29, 9, 0), 45, new Date(2026, 5, 29, 9, 45))]
    expect(getGoalProgress(goalFixture({ period: 'daily', metric: 'study_time', target: 120 }), goalSessions, now)).toBe(45)
  })

  it('clamps study_time subject progress and keeps manual progress stored under study_time mode', () => {
    const subject = subjectFixture({
      progressMode: 'study_time',
      progress: 42,
      targetHours: 1,
    })
    const sessions = [
      { ...sessionAt('a', new Date(2026, 5, 29, 9, 0), 90, new Date(2026, 5, 29, 10, 30)), subjectId: subject.id },
    ]
    expect(calculateSubjectProgress(subject, sessions)).toMatchObject({
      percentage: 100,
      mode: 'study_time',
      loggedMinutes: 90,
      targetMinutes: 60,
    })
    expect(subject.progress).toBe(42)
  })

  it('builds deterministic capped search results across entity fields', () => {
    const subject = subjectFixture({ id: 'sub-1', name: 'Chemistry', progress: 10, progressMode: 'manual', targetHours: 4 })
    const subjects = [subject]
    const subjectMap = new Map([[subject.id, subject]])
    const notes = [{
      id: 'note-1',
      title: 'Titration lab',
      body: 'Acid base balance',
      subjectId: subject.id,
      tags: ['lab'],
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    }]
    const events = [{
      id: 'event-1',
      title: 'Office hours',
      subjectId: subject.id,
      startAt: '2026-06-29T15:00:00.000Z',
      endAt: '2026-06-29T16:00:00.000Z',
      location: 'Hall A',
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    }]
    const tasks = Array.from({ length: 10 }, (_, index) => ({
      id: `task-${index}`,
      title: `Chem task ${index}`,
      subjectId: subject.id,
      dueDate: '',
      priority: 'normal' as const,
      status: 'open' as const,
      minutes: 20,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    }))
    const originalTasks = tasks.map((task) => ({ ...task }))

    expect(buildSearchResults(subjects, notes, events, tasks, [], subjectMap, '   ')).toEqual([])
    expect(buildSearchResults(subjects, notes, events, tasks, [], subjectMap, 'TITRATION')[0]).toMatchObject({
      type: 'Note',
      title: 'Titration lab',
      view: 'Notes',
    })
    expect(buildSearchResults(subjects, notes, events, tasks, [], subjectMap, 'Hall A')[0]).toMatchObject({
      type: 'Event',
      view: 'Calendar',
    })
    expect(buildSearchResults(subjects, notes, events, tasks, [], subjectMap, 'high')).toEqual([])
    expect(buildSearchResults(subjects, notes, events, tasks, [], subjectMap, 'open').every((item) => item.type === 'Task')).toBe(true)
    expect(buildSearchResults(subjects, notes, events, tasks, [], subjectMap, 'Chem task')).toHaveLength(8)
    expect(tasks).toEqual(originalTasks)
  })

  it('builds subject search metadata from calculated progress', () => {
    const subject = subjectFixture({
      id: 'subject-search',
      name: 'Physics',
      progress: 15,
      progressMode: 'study_time',
      targetHours: 1,
    })
    const subjects = [subject]
    const sessions = [
      {
        id: 'session-1',
        subjectId: subject.id,
        startedAt: '2026-06-29T09:00:00.000Z',
        endedAt: '2026-06-29T09:30:00.000Z',
        minutes: 30,
        note: '',
      },
    ]
    const subjectMap = new Map([[subject.id, subject]])

    expect(buildSearchResults(subjects, [], [], [], sessions, subjectMap, 'Physics')).toEqual([
      {
        id: 'subject-search',
        type: 'Subject',
        title: 'Physics',
        meta: '50% progress',
        view: 'Subjects',
      },
    ])
    expect(buildSearchResults(subjects, [], [], [], sessions, subjectMap, '50')).toHaveLength(1)
    expect(buildSearchResults(subjects, [], [], [], sessions, subjectMap, '15')).toEqual([])
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

  describe('subject/session aggregation optimization (S6.1)', () => {
    const sessions = [
      { id: 's1', subjectId: 'math', startedAt: '2026-06-29T09:00:00.000Z', endedAt: '2026-06-29T09:30:00.000Z', minutes: 30, note: '' },
      { id: 's2', subjectId: 'math', startedAt: '2026-06-29T10:00:00.000Z', endedAt: '2026-06-29T10:45:00.000Z', minutes: 45, note: '' },
      { id: 's3', subjectId: 'physics', startedAt: '2026-06-29T11:00:00.000Z', endedAt: '2026-06-29T12:00:00.000Z', minutes: 60, note: '' },
      { id: 's4', subjectId: 'orphaned-subj', startedAt: '2026-06-29T13:00:00.000Z', endedAt: '2026-06-29T13:20:00.000Z', minutes: 20, note: '' },
      { id: 's5', subjectId: 'chemistry', startedAt: '2026-06-29T14:00:00.000Z', endedAt: '2026-06-29T14:00:00.000Z', minutes: 0, note: '' },
    ]

    it('aggregates study session minutes by subject into a single-pass map', () => {
      const map = getSubjectStudyMinutesMap(sessions)
      expect(map.get('math')).toBe(75)
      expect(map.get('physics')).toBe(60)
      expect(map.get('orphaned-subj')).toBe(20)
      expect(map.get('chemistry')).toBeUndefined()
      expect(map.get('biology')).toBeUndefined()

      expect(getSubjectStudyMinutes('math', map)).toBe(75)
      expect(getSubjectStudyMinutes('physics', map)).toBe(60)
      expect(getSubjectStudyMinutes('biology', map)).toBe(0)
      expect(getSubjectStudyMinutes('biology', sessions)).toBe(0)

      expect(getSubjectStudyMinutesMap([])).toEqual(new Map())
    })

    it('produces strictly identical SubjectProgressResult using array vs pre-indexed Map', () => {
      const mathStudySubject = subjectFixture({ id: 'math', progressMode: 'study_time', targetHours: 2, progress: 10 })
      const mathManualSubject = subjectFixture({ id: 'math', progressMode: 'manual', targetHours: 2, progress: 10 })
      const bioStudySubject = subjectFixture({ id: 'biology', progressMode: 'study_time', targetHours: 3, progress: 0 })
      const bioManualSubject = subjectFixture({ id: 'biology', progressMode: 'manual', targetHours: 3, progress: 25 })
      const physicsStudySubject = subjectFixture({ id: 'physics', progressMode: 'study_time', targetHours: 0.5, progress: 0 })

      const map = getSubjectStudyMinutesMap(sessions)

      // 1. Math study_time (75 min logged / 120 min target = 62.5%)
      const arrayResultMath = calculateSubjectProgress(mathStudySubject, sessions)
      const mapResultMath = calculateSubjectProgress(mathStudySubject, map)
      expect(mapResultMath).toEqual(arrayResultMath)
      expect(mapResultMath).toEqual({
        percentage: 62.5,
        mode: 'study_time',
        loggedMinutes: 75,
        targetMinutes: 120,
      })

      // 2. Math manual (retains stored 10%, loggedMinutes: 75)
      const arrayResultManual = calculateSubjectProgress(mathManualSubject, sessions)
      const mapResultManual = calculateSubjectProgress(mathManualSubject, map)
      expect(mapResultManual).toEqual(arrayResultManual)
      expect(mapResultManual).toEqual({
        percentage: 10,
        mode: 'manual',
        loggedMinutes: 75,
        targetMinutes: 120,
      })

      // 3. Zero-session subject study_time (biology)
      expect(calculateSubjectProgress(bioStudySubject, map)).toEqual(calculateSubjectProgress(bioStudySubject, sessions))
      expect(calculateSubjectProgress(bioStudySubject, map)).toEqual({
        percentage: 0,
        mode: 'study_time',
        loggedMinutes: 0,
        targetMinutes: 180,
      })

      // 4. Zero-session subject manual (biology)
      expect(calculateSubjectProgress(bioManualSubject, map)).toEqual(calculateSubjectProgress(bioManualSubject, sessions))
      expect(calculateSubjectProgress(bioManualSubject, map)).toEqual({
        percentage: 25,
        mode: 'manual',
        loggedMinutes: 0,
        targetMinutes: 180,
      })

      // 5. Clamping: physics target 0.5h (30 min), logged 60 min -> 100% clamped
      expect(calculateSubjectProgress(physicsStudySubject, map)).toEqual(calculateSubjectProgress(physicsStudySubject, sessions))
      expect(calculateSubjectProgress(physicsStudySubject, map)).toEqual({
        percentage: 100,
        mode: 'study_time',
        loggedMinutes: 60,
        targetMinutes: 30,
      })

      // 6. getSubjectProgress wrapper equivalence
      expect(getSubjectProgress(mathStudySubject, map)).toBe(getSubjectProgress(mathStudySubject, sessions))
      expect(getSubjectProgress(mathManualSubject, map)).toBe(getSubjectProgress(mathManualSubject, sessions))

      // 7. inferSubjectProgressMode equivalence
      expect(inferSubjectProgressMode('math', map)).toBe(inferSubjectProgressMode('math', sessions))
      expect(inferSubjectProgressMode('math', map)).toBe('study_time')
      expect(inferSubjectProgressMode('biology', map)).toBe(inferSubjectProgressMode('biology', sessions))
      expect(inferSubjectProgressMode('biology', map)).toBe('manual')
      expect(inferSubjectProgressMode('orphaned-subj', map)).toBe('study_time')
    })

    it('buildSearchResults produces identical results when using sessions array or pre-indexed Map', () => {
      const subjects = [
        subjectFixture({ id: 'math', name: 'Mathematics', progressMode: 'study_time', targetHours: 2 }),
        subjectFixture({ id: 'physics', name: 'Physics Mechanics', progressMode: 'study_time', targetHours: 1 }),
        subjectFixture({ id: 'bio', name: 'Biology', progressMode: 'manual', targetHours: 2, progress: 40 }),
      ]
      const subjectMap = new Map(subjects.map((s) => [s.id, s]))
      const notes = [
        { id: 'n1', title: 'Math calculus', body: 'Integration formulas', subjectId: 'math', tags: ['calc'], createdAt: '', updatedAt: '' },
      ]
      const events = [
        { id: 'e1', title: 'Physics exam', subjectId: 'physics', startAt: '2026-06-29T10:00:00.000Z', endAt: '2026-06-29T12:00:00.000Z', location: 'Hall B', createdAt: '', updatedAt: '' },
      ]
      const tasks = [
        { id: 't1', title: 'Bio chapter 2', subjectId: 'bio', dueDate: '', priority: 'normal' as const, status: 'open' as const, minutes: 30, createdAt: '', updatedAt: '' },
      ]

      const map = getSubjectStudyMinutesMap(sessions)

      const queries = ['', 'Math', 'physics', 'bio', 'exam', 'calc', '100', '63', '40', 'unknown']
      for (const q of queries) {
        const fromArray = buildSearchResults(subjects, notes, events, tasks, sessions, subjectMap, q)
        const fromMap = buildSearchResults(subjects, notes, events, tasks, map, subjectMap, q)
        expect(fromMap).toEqual(fromArray)
      }
    })
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

function subjectFixture(overrides: Partial<StudySubject> = {}): StudySubject {
  return {
    id: 'math',
    name: 'Math',
    color: '#111827',
    targetHours: 2,
    progress: 10,
    progressMode: 'manual',
    createdAt: '2026-06-29T00:00:00.000Z',
    updatedAt: '2026-06-29T00:00:00.000Z',
    ...overrides,
  }
}
