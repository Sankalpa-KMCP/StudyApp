import { parseTags } from '../appUtils'
import { isSubjectProgressMode, type SubjectProgressMode } from '../db/types'
import {
  clampSubjectEditorProgress,
  clampSubjectEditorTargetHours,
} from './editorLimits'

/**
 * Message-neutral create/edit draft checks for Subjects, Notes, and Flashcards.
 * Views own user-facing copy, accessibility, mutation state, and persistence.
 */

export type SubjectEditorDraftInput = {
  name: string
  color: string
  targetHours: number
  progress: number
  progressMode: unknown
}

export type SubjectEditorFields = {
  name: string
  color: string
  targetHours: number
  progress: number
  progressMode: SubjectProgressMode
}

export type SubjectEditorDraftValidation =
  | { ok: true; fields: SubjectEditorFields }
  | { ok: false; reason: 'empty_name' | 'invalid_progress_mode' }

export function validateSubjectEditorDraft(
  draft: SubjectEditorDraftInput,
): SubjectEditorDraftValidation {
  const name = draft.name.trim()
  if (!name) {
    return { ok: false, reason: 'empty_name' }
  }

  if (!isSubjectProgressMode(draft.progressMode)) {
    return { ok: false, reason: 'invalid_progress_mode' }
  }

  return {
    ok: true,
    fields: {
      name,
      color: draft.color,
      targetHours: clampSubjectEditorTargetHours(draft.targetHours),
      progress: clampSubjectEditorProgress(draft.progress),
      progressMode: draft.progressMode,
    },
  }
}

export type NoteEditorDraftInput = {
  title: string
  body: string
  subjectId: string
  tags: string
}

export type NoteEditorFields = {
  title: string
  body: string
  subjectId: string
  tags: string[]
}

export type NoteEditorDraftValidation =
  | { ok: true; fields: NoteEditorFields }
  | { ok: false; reason: 'empty_title' }

export function validateNoteEditorDraft(draft: NoteEditorDraftInput): NoteEditorDraftValidation {
  const title = draft.title.trim()
  if (!title) {
    return { ok: false, reason: 'empty_title' }
  }

  return {
    ok: true,
    fields: {
      title,
      body: draft.body.trim(),
      subjectId: draft.subjectId,
      tags: parseTags(draft.tags),
    },
  }
}

export type FlashcardEditorDraftInput = {
  front: string
  back: string
  subjectId: string
}

export type FlashcardEditorFields = {
  front: string
  back: string
  subjectId: string
}

export type FlashcardEditorDraftValidation =
  | { ok: true; fields: FlashcardEditorFields }
  | { ok: false; reason: 'empty_sides' }

export function validateFlashcardEditorDraft(
  draft: FlashcardEditorDraftInput,
): FlashcardEditorDraftValidation {
  const front = draft.front.trim()
  const back = draft.back.trim()
  if (!front || !back) {
    return { ok: false, reason: 'empty_sides' }
  }

  return {
    ok: true,
    fields: {
      front,
      back,
      subjectId: draft.subjectId,
    },
  }
}
