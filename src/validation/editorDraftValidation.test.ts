import { describe, expect, it } from 'vitest'
import {
  validateFlashcardEditorDraft,
  validateNoteEditorDraft,
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

describe('validateFlashcardEditorDraft', () => {
  it('rejects empty or whitespace front and back with one shared reason', () => {
    expect(
      validateFlashcardEditorDraft({ front: '', back: 'Back', subjectId: '' }),
    ).toEqual({ ok: false, reason: 'empty_sides' })
    expect(
      validateFlashcardEditorDraft({ front: 'Front', back: '   ', subjectId: '' }),
    ).toEqual({ ok: false, reason: 'empty_sides' })
    expect(
      validateFlashcardEditorDraft({ front: '  ', back: '\t', subjectId: 's1' }),
    ).toEqual({ ok: false, reason: 'empty_sides' })
  })

  it('trims both sides on success', () => {
    expect(
      validateFlashcardEditorDraft({
        front: '  Power rule  ',
        back: '  n x^{n-1}  ',
        subjectId: 'math',
      }),
    ).toEqual({
      ok: true,
      fields: {
        front: 'Power rule',
        back: 'n x^{n-1}',
        subjectId: 'math',
      },
    })
  })
})
