import { describe, expect, it } from 'vitest'
import { parseLocalDateTime } from '../appUtils'
import {
  validateCalendarEventEditorDraft,
  validateGoalEditorDraft,
  validateNoteEditorDraft,
  validateStudySessionEditorDraft,
  validateSubjectEditorDraft,
} from './editorDraftValidation'

describe('validateSubjectEditorDraft', () => {
  const validDraft = {
    name: '  Physics  ',
    color: '#2563eb',
    targetHours: 5,
    progress: 20,
    progressMode: 'manual' as const,
  }

  it('rejects whitespace-only names before normalizing other fields', () => {
    expect(validateSubjectEditorDraft({ ...validDraft, name: '   ' })).toEqual({
      ok: false,
      reason: 'empty_name',
    })
  })

  it('trims the name and clamps target hours and progress on success', () => {
    expect(
      validateSubjectEditorDraft({
        ...validDraft,
        targetHours: 101,
        progress: -1,
      }),
    ).toEqual({
      ok: true,
      fields: {
        name: 'Physics',
        color: '#2563eb',
        targetHours: 100,
        progress: 0,
        progressMode: 'manual',
      },
    })
  })

  it('accepts study_time mode with the same name and clamp rules', () => {
    expect(
      validateSubjectEditorDraft({
        ...validDraft,
        progressMode: 'study_time',
        targetHours: 0,
        progress: 150,
      }),
    ).toEqual({
      ok: true,
      fields: {
        name: 'Physics',
        color: '#2563eb',
        targetHours: 1,
        progress: 100,
        progressMode: 'study_time',
      },
    })
  })

  it('rejects invalid progressMode after a valid name', () => {
    expect(
      validateSubjectEditorDraft({
        ...validDraft,
        progressMode: 'derived',
      }),
    ).toEqual({
      ok: false,
      reason: 'invalid_progress_mode',
    })
  })

  it('maps non-finite target and progress values to the editor floors', () => {
    expect(
      validateSubjectEditorDraft({
        ...validDraft,
        targetHours: Number.NaN,
        progress: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({
      ok: true,
      fields: {
        name: 'Physics',
        color: '#2563eb',
        targetHours: 1,
        progress: 0,
        progressMode: 'manual',
      },
    })
  })

  it('rejects invalid or crafted subject color strings', () => {
    expect(
      validateSubjectEditorDraft({
        ...validDraft,
        color: "url('https://tracker.invalid/beacon.png')",
      }),
    ).toEqual({
      ok: false,
      reason: 'invalid_color',
    })

    expect(validateSubjectEditorDraft({ ...validDraft, color: 'red' })).toEqual({
      ok: false,
      reason: 'invalid_color',
    })

    expect(validateSubjectEditorDraft({ ...validDraft, color: '#fff' })).toEqual({
      ok: false,
      reason: 'invalid_color',
    })

    expect(validateSubjectEditorDraft({ ...validDraft, color: '#12GG56' })).toEqual({
      ok: false,
      reason: 'invalid_color',
    })

    expect(validateSubjectEditorDraft({ ...validDraft, color: '' })).toEqual({
      ok: false,
      reason: 'invalid_color',
    })
  })

  it('accepts valid 6-digit hex colors', () => {
    expect(
      validateSubjectEditorDraft({
        ...validDraft,
        color: '#047857',
      }),
    ).toEqual({
      ok: true,
      fields: {
        name: 'Physics',
        color: '#047857',
        targetHours: 5,
        progress: 20,
        progressMode: 'manual',
      },
    })
  })
})

describe('validateNoteEditorDraft', () => {
  it('rejects whitespace-only titles', () => {
    expect(
      validateNoteEditorDraft({
        title: '  \t  ',
        body: 'kept',
        subjectId: 'subject-1',
        tags: 'exam, formulas',
      }),
    ).toEqual({
      ok: false,
      reason: 'empty_title',
    })
  })

  it('trims title and body, accepts empty body, and parses tags like parseTags', () => {
    expect(
      validateNoteEditorDraft({
        title: '  Checklist  ',
        body: '  Past papers  ',
        subjectId: 'subject-1',
        tags: ' exam, , formulas ,exam ',
      }),
    ).toEqual({
      ok: true,
      fields: {
        title: 'Checklist',
        body: 'Past papers',
        subjectId: 'subject-1',
        tags: ['exam', 'formulas', 'exam'],
      },
    })

    expect(
      validateNoteEditorDraft({
        title: 'Empty body note',
        body: '   ',
        subjectId: '',
        tags: '',
      }),
    ).toEqual({
      ok: true,
      fields: {
        title: 'Empty body note',
        body: '',
        subjectId: '',
        tags: [],
      },
    })
  })
})

describe('validateCalendarEventEditorDraft', () => {
  const validDraft = {
    title: '  Study block  ',
    subjectId: 'subject-1',
    date: '2026-08-01',
    time: '14:30',
    duration: 60,
    location: '  Library  ',
  }

  it('rejects whitespace-only titles before parsing date or duration', () => {
    expect(validateCalendarEventEditorDraft({ ...validDraft, title: '   ' })).toEqual({
      ok: false,
      reason: 'empty_title',
    })
  })

  it('rejects malformed or missing local date/time via parseLocalDateTime', () => {
    expect(validateCalendarEventEditorDraft({ ...validDraft, date: '', time: '14:30' })).toEqual({
      ok: false,
      reason: 'invalid_start',
    })
    expect(validateCalendarEventEditorDraft({ ...validDraft, date: '2026-08-01', time: '' })).toEqual({
      ok: false,
      reason: 'invalid_start',
    })
    expect(validateCalendarEventEditorDraft({ ...validDraft, date: '2026-02-30', time: '14:30' })).toEqual({
      ok: false,
      reason: 'invalid_start',
    })
  })

  it('rejects non-finite and below-minimum durations without enforcing the NumberInput ceiling on save', () => {
    expect(validateCalendarEventEditorDraft({ ...validDraft, duration: 14 })).toEqual({
      ok: false,
      reason: 'invalid_duration',
    })
    expect(validateCalendarEventEditorDraft({ ...validDraft, duration: Number.NaN })).toEqual({
      ok: false,
      reason: 'invalid_duration',
    })
    expect(validateCalendarEventEditorDraft({ ...validDraft, duration: Number.POSITIVE_INFINITY })).toEqual({
      ok: false,
      reason: 'invalid_duration',
    })

    const atMin = validateCalendarEventEditorDraft({ ...validDraft, duration: 15 })
    expect(atMin.ok).toBe(true)
    const atUiMax = validateCalendarEventEditorDraft({ ...validDraft, duration: 480 })
    expect(atUiMax.ok).toBe(true)
    const aboveUiMax = validateCalendarEventEditorDraft({ ...validDraft, duration: 481 })
    expect(aboveUiMax.ok).toBe(true)
  })

  it('trims title and location and derives local startAt/endAt from duration', () => {
    const startedAt = parseLocalDateTime('2026-08-01', '14:30')
    expect(startedAt).not.toBeNull()
    expect(validateCalendarEventEditorDraft({ ...validDraft, duration: 90 })).toEqual({
      ok: true,
      fields: {
        title: 'Study block',
        subjectId: 'subject-1',
        startAt: startedAt!.toISOString(),
        endAt: new Date(startedAt!.getTime() + 90 * 60_000).toISOString(),
        location: 'Library',
      },
    })
  })
})

describe('validateStudySessionEditorDraft', () => {
  const validDraft = {
    subjectId: '',
    date: '2026-07-13',
    time: '13:00',
    duration: '30',
    note: '  Momentum  ',
    subjectMissing: false,
    nowMs: new Date(2026, 6, 13, 15, 0).getTime(),
  }

  it('accepts General and known subjects, rejecting only missing non-empty subjects first', () => {
    expect(
      validateStudySessionEditorDraft({
        ...validDraft,
        subjectId: 'gone',
        subjectMissing: true,
        date: '',
        duration: '0',
      }),
    ).toEqual({ ok: false, reason: 'missing_subject' })

    expect(validateStudySessionEditorDraft({ ...validDraft, subjectId: '' }).ok).toBe(true)
    expect(validateStudySessionEditorDraft({ ...validDraft, subjectId: 'physics' }).ok).toBe(true)
  })

  it('rejects malformed start, non-integer or sub-minimum duration, then future ends', () => {
    expect(validateStudySessionEditorDraft({ ...validDraft, date: '' })).toEqual({
      ok: false,
      reason: 'invalid_start',
    })
    expect(validateStudySessionEditorDraft({ ...validDraft, duration: '0' })).toEqual({
      ok: false,
      reason: 'invalid_duration',
    })
    expect(validateStudySessionEditorDraft({ ...validDraft, duration: '1.5' })).toEqual({
      ok: false,
      reason: 'invalid_duration',
    })
    expect(validateStudySessionEditorDraft({ ...validDraft, duration: '1' }).ok).toBe(true)

    const future = validateStudySessionEditorDraft({
      ...validDraft,
      time: '14:30',
      duration: '45',
    })
    expect(future).toEqual({ ok: false, reason: 'future_end' })
  })

  it('stores the same local timestamps and trimmed note as the Progress editor', () => {
    const startedAt = parseLocalDateTime('2026-07-13', '13:00')
    expect(startedAt).not.toBeNull()
    expect(validateStudySessionEditorDraft(validDraft)).toEqual({
      ok: true,
      fields: {
        subjectId: '',
        startedAt: startedAt!.toISOString(),
        endedAt: new Date(startedAt!.getTime() + 30 * 60_000).toISOString(),
        minutes: 30,
        note: 'Momentum',
      },
    })
  })
})

describe('validateGoalEditorDraft', () => {
  const validDraft = {
    title: '  Daily focus  ',
    target: 60,
    progress: 10,
    period: 'daily' as const,
    metric: 'manual' as const,
  }

  it('rejects whitespace-only titles before metric or target checks', () => {
    expect(validateGoalEditorDraft({ ...validDraft, title: '   ', metric: 'derived' })).toEqual({
      ok: false,
      reason: 'empty_title',
    })
  })

  it('rejects invalid metrics before target normalization', () => {
    expect(validateGoalEditorDraft({ ...validDraft, metric: 'derived' })).toEqual({
      ok: false,
      reason: 'invalid_metric',
    })
  })

  it('rejects non-finite, zero, and negative targets without clamping them', () => {
    expect(validateGoalEditorDraft({ ...validDraft, target: Number.NaN })).toEqual({
      ok: false,
      reason: 'invalid_target',
    })
    expect(validateGoalEditorDraft({ ...validDraft, target: 0 })).toEqual({
      ok: false,
      reason: 'invalid_target',
    })
    expect(validateGoalEditorDraft({ ...validDraft, target: -3 })).toEqual({
      ok: false,
      reason: 'invalid_target',
    })
  })

  it('rounds and clamps valid targets to 1–10000 and clamps manual progress to [0, target]', () => {
    expect(validateGoalEditorDraft({ ...validDraft, target: 1.4, progress: -5 })).toEqual({
      ok: true,
      fields: {
        title: 'Daily focus',
        target: 1,
        progress: 0,
        period: 'daily',
        metric: 'manual',
      },
    })

    expect(validateGoalEditorDraft({
      ...validDraft,
      target: 10_001,
      progress: 50_000,
    })).toEqual({
      ok: true,
      fields: {
        title: 'Daily focus',
        target: 10_000,
        progress: 10_000,
        period: 'daily',
        metric: 'manual',
      },
    })

    expect(validateGoalEditorDraft({
      ...validDraft,
      target: 25.6,
      progress: 25.4,
    })).toEqual({
      ok: true,
      fields: {
        title: 'Daily focus',
        target: 26,
        progress: 25,
        period: 'daily',
        metric: 'manual',
      },
    })
  })

  it('leaves study_time progress unclamped while still normalizing target', () => {
    expect(validateGoalEditorDraft({
      ...validDraft,
      metric: 'study_time',
      period: 'weekly',
      target: 4.2,
      progress: 99,
    })).toEqual({
      ok: true,
      fields: {
        title: 'Daily focus',
        target: 4,
        progress: 99,
        period: 'weekly',
        metric: 'study_time',
      },
    })
  })
})
