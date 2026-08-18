import { describe, expect, it } from 'vitest'
import { buildFirstStudyChecklistSteps, hasStartedFocusSession } from './firstStudyChecklistData'

describe('firstStudyChecklist helpers', () => {
  it('defines exactly three onboarding steps in the approved order and wording', () => {
    const steps = buildFirstStudyChecklistSteps({
      hasSubject: false,
      hasTask: false,
      hasStartedFocus: false,
    })

    expect(steps).toHaveLength(3)
    expect(steps.map((step) => step.title)).toEqual([
      'Create a subject',
      'Add your first task',
      'Start a focus session',
    ])
    expect(steps.map((step) => step.actionLabel)).toEqual([
      'Create subject',
      'Add task',
      'Go to focus',
    ])

    const copy = steps.map((step) => `${step.title} ${step.body}`).join(' ')
    expect(copy).not.toMatch(/calendar event|event|manual session|log session|quiz|material|content generation/i)
  })

  it('derives focus completion from active or stale focus before finalized history', () => {
    expect(hasStartedFocusSession({
      id: 'focus-active',
      subjectId: '',
      startedAt: '2026-07-27T08:00:00.000Z',
      plannedMinutes: 25,
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: 0,
    }, null, [])).toBe(true)

    expect(hasStartedFocusSession(null, {
      id: 'focus-stale',
      subjectId: '',
      startedAt: '2026-07-26T08:00:00.000Z',
      plannedMinutes: 25,
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: 0,
    }, [])).toBe(true)
  })

  it('counts finalized focus history by focus-prefixed ids and ignores manual sessions', () => {
    expect(hasStartedFocusSession(null, null, [
      {
        id: 'session-manual',
        subjectId: '',
        startedAt: '2026-07-27T08:00:00.000Z',
        endedAt: '2026-07-27T08:30:00.000Z',
        minutes: 30,
        note: '',
      },
    ])).toBe(false)

    expect(hasStartedFocusSession(null, null, [
      {
        id: 'focus-123',
        subjectId: '',
        startedAt: '2026-07-27T08:00:00.000Z',
        endedAt: '2026-07-27T08:30:00.000Z',
        minutes: 30,
        note: '',
      },
    ])).toBe(true)
  })
})
