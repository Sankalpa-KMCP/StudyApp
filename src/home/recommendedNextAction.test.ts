import { describe, expect, it } from 'vitest'
import type { ActiveFocusSession, CalendarEvent, Flashcard, StudySubject, StudyTask } from '../db/types'
import { getRecommendedNextAction } from './recommendedNextAction'

const NOW = new Date(2026, 6, 26, 15, 30, 0, 0)
const TODAY = '2026-07-26'
const YESTERDAY = '2026-07-25'

function task(partial: Partial<StudyTask> & Pick<StudyTask, 'id' | 'title'>): StudyTask {
  return {
    subjectId: '',
    dueDate: '',
    priority: 'normal',
    status: 'open',
    minutes: 30,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...partial,
  }
}

function card(partial: Partial<Flashcard> & Pick<Flashcard, 'id' | 'front'>): Flashcard {
  return {
    back: 'Answer',
    subjectId: '',
    status: 'learning',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...partial,
  }
}

function event(partial: Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'title' | 'startAt'>): CalendarEvent {
  return {
    subjectId: '',
    endAt: partial.startAt,
    location: '',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...partial,
  }
}

function subject(id = 'sub-1'): StudySubject {
  return {
    id,
    name: 'Physics',
    color: '#2563eb',
    targetHours: 2,
    progress: 0,
    progressMode: 'manual',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  }
}

function activeSession(id = 'focus-1'): ActiveFocusSession {
  return {
    id,
    subjectId: '',
    startedAt: new Date(2026, 6, 26, 14, 0, 0, 0).toISOString(),
    status: 'running',
    plannedMinutes: 25,
    pausedAt: null,
    accumulatedPausedMs: 0,
  }
}

const base = {
  tasks: [] as StudyTask[],
  flashcards: [] as Flashcard[],
  events: [] as CalendarEvent[],
  subjects: [subject()],
  activeSession: null as ActiveFocusSession | null,
  todayFocusMinutes: 0,
  dailyGoalMinutes: 120,
  now: NOW,
}

describe('getRecommendedNextAction', () => {
  it('prefers the first overdue open task over every lower-priority item', () => {
    const overdueOlder = task({ id: 'o1', title: 'Older overdue', dueDate: '2026-07-20', createdAt: '2026-07-01T00:00:00.000Z' })
    const overdueNewer = task({ id: 'o2', title: 'Newer overdue', dueDate: YESTERDAY, createdAt: '2026-07-02T00:00:00.000Z' })
    const dueToday = task({ id: 't1', title: 'Due today', dueDate: TODAY })
    const dueCard = card({ id: 'c1', front: 'Card', dueAt: new Date(2026, 6, 25).toISOString() })
    const todayEvent = event({
      id: 'e1',
      title: 'Event',
      startAt: new Date(2026, 6, 26, 10, 0, 0, 0).toISOString(),
    })
    const tasks = [dueToday, overdueOlder, overdueNewer]
    const flashcards = [dueCard]
    const events = [todayEvent]
    const subjects = [subject()]
    const session = activeSession()

    expect(getRecommendedNextAction({
      ...base,
      tasks,
      flashcards,
      events,
      subjects,
      activeSession: session,
    })).toEqual({
      kind: 'overdue_task',
      intent: 'navigate',
      view: 'Tasks',
      recordId: 'o1',
      title: 'Older overdue',
    })
    expect(tasks.map((item) => item.id)).toEqual(['t1', 'o1', 'o2'])
    expect(flashcards[0]).toBe(dueCard)
    expect(events[0]).toBe(todayEvent)
  })

  it('prefers the first due-today task when no overdue task exists', () => {
    const dueToday = task({ id: 't1', title: 'Essay', dueDate: TODAY, createdAt: '2026-07-01T00:00:00.000Z' })
    const dueLater = task({ id: 't2', title: 'Later', dueDate: TODAY, createdAt: '2026-07-02T00:00:00.000Z' })
    expect(getRecommendedNextAction({
      ...base,
      tasks: [dueToday, dueLater],
      flashcards: [card({ id: 'c1', front: 'Card' })],
      events: [event({ id: 'e1', title: 'Event', startAt: new Date(2026, 6, 26, 9, 0).toISOString() })],
      activeSession: activeSession(),
    })).toMatchObject({ kind: 'due_today_task', recordId: 't1', view: 'Tasks' })
  })

  it('prefers a due flashcard after tasks are cleared', () => {
    const firstDue = card({ id: 'c1', front: 'First', createdAt: '2026-07-01T00:00:00.000Z' })
    const secondDue = card({ id: 'c2', front: 'Second', createdAt: '2026-07-02T00:00:00.000Z' })
    expect(getRecommendedNextAction({
      ...base,
      flashcards: [firstDue, secondDue],
      events: [event({ id: 'e1', title: 'Event', startAt: new Date(2026, 6, 26, 9, 0).toISOString() })],
      activeSession: activeSession(),
    })).toEqual({
      kind: 'due_flashcard',
      intent: 'navigate',
      view: 'Flashcards',
      recordId: 'c1',
      title: 'First',
    })
  })

  it('prefers today’s earliest event after tasks and flashcards', () => {
    const later = event({
      id: 'e-late',
      title: 'Later',
      startAt: new Date(2026, 6, 26, 16, 0).toISOString(),
    })
    const earlier = event({
      id: 'e-early',
      title: 'Earlier',
      startAt: new Date(2026, 6, 26, 9, 0).toISOString(),
    })
    expect(getRecommendedNextAction({
      ...base,
      events: [later, earlier],
      activeSession: activeSession(),
    })).toMatchObject({ kind: 'today_event', recordId: 'e-early', view: 'Calendar', title: 'Earlier' })
  })

  it('recommends continuing an active focus session before create-subject', () => {
    expect(getRecommendedNextAction({
      ...base,
      subjects: [],
      activeSession: activeSession('running-1'),
    })).toEqual({
      kind: 'continue_focus',
      intent: 'focus_card',
      recordId: 'running-1',
    })
  })

  it('recommends starting focus when subjects exist and no urgent item qualifies', () => {
    expect(getRecommendedNextAction({
      ...base,
      todayFocusMinutes: 30,
      dailyGoalMinutes: 120,
    })).toEqual({
      kind: 'start_focus',
      intent: 'focus_card',
    })
  })

  it('recommends create subject when there are no subjects and no higher item qualifies', () => {
    expect(getRecommendedNextAction({
      ...base,
      subjects: [],
      activeSession: null,
    })).toEqual({
      kind: 'create_subject',
      intent: 'create_subject',
    })
  })

  it('returns a deterministic neutral fallback when the daily focus target is already met', () => {
    expect(getRecommendedNextAction({
      ...base,
      todayFocusMinutes: 120,
      dailyGoalMinutes: 120,
    })).toEqual({
      kind: 'neutral',
      intent: 'navigate',
      view: 'Progress',
    })
  })

  it('does not mutate input arrays', () => {
    const tasks = [task({ id: 't', title: 'T', dueDate: YESTERDAY })]
    const flashcards = [card({ id: 'c', front: 'C' })]
    const events = [event({ id: 'e', title: 'E', startAt: new Date(2026, 6, 26, 11, 0).toISOString() })]
    const subjects = [subject()]
    const taskIds = tasks.map((item) => item.id)
    getRecommendedNextAction({ ...base, tasks, flashcards, events, subjects })
    expect(tasks.map((item) => item.id)).toEqual(taskIds)
    expect(flashcards).toHaveLength(1)
    expect(events).toHaveLength(1)
    expect(subjects).toHaveLength(1)
  })
})
